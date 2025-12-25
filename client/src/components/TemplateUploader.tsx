import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileUp, Loader2, CheckCircle2, AlertCircle, FileText, Sparkles, Upload } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface TemplateAnalysisResult {
  logo: {
    position: string;
    approximate_size: string;
  };
  brandColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  layout: {
    header: {
      includes_company_name: boolean;
      includes_abn: boolean;
      includes_contact_info: boolean;
    };
    lineItems: {
      columns: string[];
      has_item_numbers: boolean;
    };
    totals: {
      position: string;
      shows_subtotal: boolean;
      shows_gst: boolean;
      shows_total: boolean;
    };
    footer: {
      has_terms: boolean;
      has_payment_details: boolean;
      has_signature_block: boolean;
    };
  };
  typography: {
    style: string;
  };
  detected_sections: string[];
  suggestedTemplateName: string;
}

interface AnalysisJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  templateType: string;
  originalFileName: string;
  analysisResult?: TemplateAnalysisResult;
  createdTemplateId?: string;
  error?: string;
}

interface TemplateUploaderProps {
  onComplete?: (templateId: string) => void;
}

export function TemplateUploader({ onComplete }: TemplateUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [templateType, setTemplateType] = useState<'quote' | 'invoice'>('quote');
  const [templateName, setTemplateName] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<AnalysisJob | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async ({ file, templateType, name }: { file: File; templateType: string; name?: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('templateType', templateType);
      if (name) {
        formData.append('name', name);
      }

      const response = await fetch('/api/templates/analyze', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      return response.json() as Promise<{ jobId: string; status: string }>;
    },
    onSuccess: (data) => {
      setJobId(data.jobId);
      setJobStatus({
        id: data.jobId,
        status: 'processing',
        templateType,
        originalFileName: selectedFile?.name || 'unknown',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload template.',
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (!jobId || (jobStatus?.status !== 'processing' && jobStatus?.status !== 'pending')) {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/templates/analyze/${jobId}`, {
          credentials: 'include',
        });

        if (response.ok) {
          const job = await response.json() as AnalysisJob;
          setJobStatus(job);

          if (job.status === 'completed' || job.status === 'failed') {
            clearInterval(pollInterval);

            if (job.status === 'completed' && job.createdTemplateId) {
              queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
              toast({
                title: 'Template created',
                description: 'Your template has been analyzed and created successfully.',
              });
              onComplete?.(job.createdTemplateId);
            } else if (job.status === 'failed') {
              toast({
                title: 'Analysis failed',
                description: job.error || 'Failed to analyze template.',
                variant: 'destructive',
              });
            }
          }
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [jobId, jobStatus?.status, toast, onComplete]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    handleFile(file);
  };

  const handleFile = (file: File | undefined) => {
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({
          title: 'Invalid file type',
          description: 'Please upload a PDF file.',
          variant: 'destructive',
        });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please upload a file smaller than 10MB.',
          variant: 'destructive',
        });
        return;
      }
      setSelectedFile(file);
      if (!templateName) {
        setTemplateName(file.name.replace(/\.pdf$/i, ''));
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        title: 'No file selected',
        description: 'Please select a PDF file to analyze.',
        variant: 'destructive',
      });
      return;
    }
    uploadMutation.mutate({
      file: selectedFile,
      templateType,
      name: templateName.trim() || undefined,
    });
  };

  const handleReset = () => {
    setSelectedFile(null);
    setTemplateName('');
    setJobId(null);
    setJobStatus(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const renderAnalysisPreview = (result: TemplateAnalysisResult) => {
    return (
      <div className="space-y-4 mt-4" data-testid="div-analysis-preview">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          <span>AI Analysis Results</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Style</Label>
            <p className="text-sm font-medium capitalize">{result.typography.style}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Logo Position</Label>
            <p className="text-sm font-medium capitalize">{result.logo.position.replace('-', ' ')}</p>
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Brand Colors</Label>
          <div className="flex gap-2">
            <div
              className="w-8 h-8 rounded-md border"
              style={{ backgroundColor: result.brandColors.primary }}
              title={`Primary: ${result.brandColors.primary}`}
            />
            <div
              className="w-8 h-8 rounded-md border"
              style={{ backgroundColor: result.brandColors.secondary }}
              title={`Secondary: ${result.brandColors.secondary}`}
            />
            <div
              className="w-8 h-8 rounded-md border"
              style={{ backgroundColor: result.brandColors.accent }}
              title={`Accent: ${result.brandColors.accent}`}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Detected Sections</Label>
          <div className="flex flex-wrap gap-1">
            {result.detected_sections.map((section) => (
              <Badge key={section} variant="secondary" className="text-xs capitalize">
                {section.replace('_', ' ')}
              </Badge>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className={result.layout.header.includes_abn ? 'text-green-600' : 'text-muted-foreground'}>
              {result.layout.header.includes_abn ? '✓' : '✗'}
            </span>
            <span>ABN</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={result.layout.totals.shows_gst ? 'text-green-600' : 'text-muted-foreground'}>
              {result.layout.totals.shows_gst ? '✓' : '✗'}
            </span>
            <span>GST</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={result.layout.footer.has_terms ? 'text-green-600' : 'text-muted-foreground'}>
              {result.layout.footer.has_terms ? '✓' : '✗'}
            </span>
            <span>Terms</span>
          </div>
        </div>
      </div>
    );
  };

  const isProcessing = uploadMutation.isPending || jobStatus?.status === 'processing';
  const isCompleted = jobStatus?.status === 'completed';
  const isFailed = jobStatus?.status === 'failed';

  return (
    <Card data-testid="card-template-uploader">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileUp className="h-5 w-5" />
          Upload Your Template
        </CardTitle>
        <CardDescription>
          Upload an existing quote or invoice PDF and our AI will analyze it to create a matching template
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isCompleted && !isProcessing && (
          <>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : selectedFile
                  ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              data-testid="dropzone-pdf-upload"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileSelect}
                data-testid="input-file-pdf"
              />
              {selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="h-12 w-12 text-green-600" />
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    data-testid="button-remove-file"
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm font-medium">Drop your PDF here or click to browse</p>
                  <p className="text-xs text-muted-foreground">PDF files up to 10MB</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="templateType">Template Type</Label>
                <Select
                  value={templateType}
                  onValueChange={(v) => setTemplateType(v as 'quote' | 'invoice')}
                >
                  <SelectTrigger id="templateType" data-testid="select-template-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quote" data-testid="option-quote">Quote</SelectItem>
                    <SelectItem value="invoice" data-testid="option-invoice">Invoice</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="templateName">Template Name (optional)</Label>
                <Input
                  id="templateName"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="My Custom Template"
                  data-testid="input-template-name"
                />
              </div>
            </div>

            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploadMutation.isPending}
              className="w-full"
              data-testid="button-analyze-template"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyze Template
                </>
              )}
            </Button>
          </>
        )}

        {isProcessing && (
          <div className="text-center py-8" data-testid="div-processing-state">
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
            <p className="text-sm font-medium">Analyzing your template...</p>
            <p className="text-xs text-muted-foreground mt-1">
              Our AI is extracting the structure and style from your document
            </p>
            {jobStatus?.originalFileName && (
              <p className="text-xs text-muted-foreground mt-2">
                Processing: {jobStatus.originalFileName}
              </p>
            )}
          </div>
        )}

        {isCompleted && jobStatus?.analysisResult && (
          <div data-testid="div-completed-state">
            <div className="flex items-center gap-2 text-green-600 mb-4">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Template analyzed successfully!</span>
            </div>
            
            {renderAnalysisPreview(jobStatus.analysisResult)}

            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                onClick={handleReset}
                className="flex-1"
                data-testid="button-upload-another"
              >
                Upload Another
              </Button>
              {jobStatus.createdTemplateId && (
                <Button
                  onClick={() => onComplete?.(jobStatus.createdTemplateId!)}
                  className="flex-1"
                  data-testid="button-use-template"
                >
                  Use This Template
                </Button>
              )}
            </div>
          </div>
        )}

        {isFailed && (
          <div data-testid="div-failed-state">
            <div className="flex items-center gap-2 text-destructive mb-4">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Analysis failed</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {jobStatus?.error || 'Something went wrong. Please try again.'}
            </p>
            <Button
              variant="outline"
              onClick={handleReset}
              className="w-full"
              data-testid="button-try-again"
            >
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
