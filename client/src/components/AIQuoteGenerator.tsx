import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, Mic, Camera, CheckCircle2, AlertCircle, ImagePlus, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface QuoteLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: 'labour' | 'materials' | 'equipment' | 'other';
}

interface AIQuoteResult {
  success: boolean;
  jobType: string;
  description: string;
  lineItems: QuoteLineItem[];
  totalEstimate: number;
  gstAmount: number;
  grandTotal: number;
  confidence: 'high' | 'medium' | 'low';
  notes: string[];
  suggestedTitle: string;
}

interface JobPhoto {
  id: number;
  filename: string;
  mimeType: string;
  signedUrl?: string;
}

interface AIQuoteGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId?: string;
  onApplyItems: (items: QuoteLineItem[], title?: string, description?: string) => void;
}

export default function AIQuoteGenerator({ open, onOpenChange, jobId, onApplyItems }: AIQuoteGeneratorProps) {
  const { toast } = useToast();
  const [jobDescription, setJobDescription] = useState("");
  const [voiceTranscription, setVoiceTranscription] = useState("");
  const [result, setResult] = useState<AIQuoteResult | null>(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<number>>(new Set());
  const [uploadedPhotos, setUploadedPhotos] = useState<Array<{ file: File; preview: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: jobPhotos = [], isLoading: photosLoading } = useQuery<JobPhoto[]>({
    queryKey: ['/api/jobs', jobId, 'photos'],
    queryFn: async () => {
      if (!jobId) return [];
      const response = await fetch(`/api/jobs/${jobId}/photos`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!jobId && open,
  });

  const imagePhotos = jobPhotos.filter(p => p.mimeType?.startsWith('image/'));

  useEffect(() => {
    if (open && imagePhotos.length > 0 && selectedPhotoIds.size === 0) {
      setSelectedPhotoIds(new Set(imagePhotos.map(p => p.id)));
    }
  }, [open, imagePhotos.length]);

  useEffect(() => {
    if (!open) {
      setResult(null);
      setJobDescription("");
      setVoiceTranscription("");
      setSelectedPhotoIds(new Set());
      setUploadedPhotos([]);
    }
  }, [open]);

  const togglePhotoSelection = (photoId: number) => {
    const newSet = new Set(selectedPhotoIds);
    if (newSet.has(photoId)) {
      newSet.delete(photoId);
    } else {
      newSet.add(photoId);
    }
    setSelectedPhotoIds(newSet);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newPhotos: Array<{ file: File; preview: string }> = [];
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        newPhotos.push({
          file,
          preview: URL.createObjectURL(file),
        });
      }
    });
    setUploadedPhotos(prev => [...prev, ...newPhotos]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeUploadedPhoto = (index: number) => {
    setUploadedPhotos(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const selectedPhotos = imagePhotos.filter(p => selectedPhotoIds.has(p.id));
      const photoUrls = selectedPhotos.map(p => p.signedUrl).filter(Boolean) as string[];

      if (uploadedPhotos.length > 0) {
        for (const { file } of uploadedPhotos) {
          const base64 = await fileToBase64(file);
          photoUrls.push(base64);
        }
      }

      const response = await apiRequest('/api/ai/generate-quote', {
        method: 'POST',
        body: JSON.stringify({
          jobId,
          photoUrls,
          jobDescription: jobDescription.trim() || undefined,
          voiceTranscription: voiceTranscription.trim() || undefined,
        }),
      });
      return response as AIQuoteResult;
    },
    onSuccess: (data) => {
      setResult(data);
      if (!data.success) {
        toast({
          title: "Could not generate quote",
          description: data.notes[0] || "Please try again with more details",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate quote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleApply = () => {
    if (result && result.lineItems.length > 0) {
      onApplyItems(result.lineItems, result.suggestedTitle, result.description);
      onOpenChange(false);
    }
  };

  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">High Confidence</Badge>;
      case 'medium':
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Medium Confidence</Badge>;
      case 'low':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Low Confidence</Badge>;
    }
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      labour: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      materials: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      equipment: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      other: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
    };
    return <Badge className={colors[category] || colors.other}>{category}</Badge>;
  };

  const totalPhotosSelected = selectedPhotoIds.size + uploadedPhotos.length;
  const hasInput = jobDescription.trim() || voiceTranscription.trim() || totalPhotosSelected > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Quote Generator
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add photos, describe the job, or use voice notes - I'll generate quote line items with realistic Australian pricing.
            </p>

            {(imagePhotos.length > 0 || uploadedPhotos.length > 0) && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Photos for Analysis
                  {totalPhotosSelected > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {totalPhotosSelected} selected
                    </Badge>
                  )}
                </Label>
                
                <ScrollArea className="w-full">
                  <div className="flex gap-2 pb-2">
                    {imagePhotos.map((photo) => {
                      const isSelected = selectedPhotoIds.has(photo.id);
                      return (
                        <div
                          key={photo.id}
                          className={`relative shrink-0 w-20 h-20 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                            isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-muted-foreground/30'
                          }`}
                          onClick={() => togglePhotoSelection(photo.id)}
                        >
                          <img
                            src={photo.signedUrl || `/api/jobs/${jobId}/photos/${photo.id}/view`}
                            alt={photo.filename}
                            className="w-full h-full object-cover"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                <Check className="h-4 w-4 text-primary-foreground" />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {uploadedPhotos.map((photo, index) => (
                      <div
                        key={`uploaded-${index}`}
                        className="relative shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 border-primary ring-2 ring-primary/30"
                      >
                        <img
                          src={photo.preview}
                          alt={`Upload ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => removeUploadedPhoto(index)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center pointer-events-none">
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-4 w-4 text-primary-foreground" />
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                      <ImagePlus className="h-5 w-5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Add</span>
                    </button>
                  </div>
                </ScrollArea>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />

                {imagePhotos.length > 0 && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setSelectedPhotoIds(new Set(imagePhotos.map(p => p.id)))}
                    >
                      Select all
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setSelectedPhotoIds(new Set())}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>
            )}

            {imagePhotos.length === 0 && uploadedPhotos.length === 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Photos (optional)
                </Label>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-24 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Upload photos for AI analysis</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="job-description">Job Description</Label>
              <Textarea
                id="job-description"
                placeholder="e.g., Replace hot water system in bathroom. Old unit is 25 litres, needs upgrading to 50L. Access through laundry..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={3}
                data-testid="input-ai-job-description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="voice-notes" className="flex items-center gap-2">
                <Mic className="h-4 w-4" />
                Voice Notes (optional)
              </Label>
              <Textarea
                id="voice-notes"
                placeholder="Paste transcription from voice recording..."
                value={voiceTranscription}
                onChange={(e) => setVoiceTranscription(e.target.value)}
                rows={2}
                data-testid="input-ai-voice-notes"
              />
            </div>

            {totalPhotosSelected > 0 && (
              <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 rounded-md p-2">
                <Camera className="h-4 w-4" />
                <span>AI will analyse {totalPhotosSelected} photo{totalPhotosSelected !== 1 ? 's' : ''} to suggest accurate line items</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-medium">{result.suggestedTitle}</h3>
              {getConfidenceBadge(result.confidence)}
            </div>

            {result.description && (
              <p className="text-sm text-muted-foreground">{result.description}</p>
            )}

            <div className="space-y-2">
              <Label>Generated Line Items</Label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {result.lineItems.map((item, index) => (
                  <Card key={index} className="overflow-hidden">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{item.description}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {getCategoryBadge(item.category)}
                            <span className="text-xs text-muted-foreground">
                              {item.quantity} × ${item.unitPrice.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <span className="font-medium shrink-0">${item.total.toFixed(2)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>${result.totalEstimate.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>GST (10%)</span>
                <span>${result.gstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total (inc. GST)</span>
                <span>${result.grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {result.notes.length > 0 && (
              <div className="bg-muted/50 rounded-md p-3 text-xs space-y-1">
                <p className="font-medium flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Notes
                </p>
                {result.notes.map((note, i) => (
                  <p key={i} className="text-muted-foreground">• {note}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex gap-2">
          {!result ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-ai-quote">
                Cancel
              </Button>
              <Button 
                onClick={() => generateMutation.mutate()} 
                disabled={generateMutation.isPending || !hasInput}
                data-testid="button-generate-ai-quote"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analysing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Quote
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outline" 
                onClick={() => {
                  setResult(null);
                }}
                data-testid="button-regenerate-ai-quote"
              >
                Try Again
              </Button>
              <Button 
                onClick={handleApply}
                disabled={!result.success || result.lineItems.length === 0}
                data-testid="button-apply-ai-quote"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Apply to Quote
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
