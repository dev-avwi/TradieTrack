import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Sparkles, Mic, Camera, CheckCircle2, AlertCircle, X, ImagePlus } from "lucide-react";
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
  const [photos, setPhotos] = useState<string[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [result, setResult] = useState<AIQuoteResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploadingPhoto(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        if (photos.length >= 5) {
          toast({ title: "Max 5 photos", description: "You can upload up to 5 photos", variant: "destructive" });
          break;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          if (base64) {
            setPhotos(prev => [...prev.slice(0, 4), base64]);
          }
        };
        reader.readAsDataURL(file);
      }
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/ai/generate-quote', {
        jobId,
        jobDescription: jobDescription.trim() || undefined,
        voiceTranscription: voiceTranscription.trim() || undefined,
        photoBase64: photos.length > 0 ? photos : undefined,
      });
      return await response.json() as AIQuoteResult;
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
      setResult(null);
      setJobDescription("");
      setVoiceTranscription("");
      setPhotos([]);
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
              Describe the job and I'll generate quote line items with realistic Australian pricing.
            </p>

            <div className="space-y-2">
              <Label htmlFor="job-description">Job Description</Label>
              <Textarea
                id="job-description"
                placeholder="e.g., Replace hot water system in bathroom. Old unit is 25 litres, needs upgrading to 50L. Access through laundry..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={4}
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

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Job Photos (optional - AI will analyze)
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
                data-testid="input-ai-photos"
              />
              <div className="flex flex-wrap gap-2">
                {photos.map((photo, idx) => (
                  <div key={idx} className="relative w-16 h-16 rounded-md overflow-hidden border">
                    <img src={photo} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute top-0.5 right-0.5 p-0.5 bg-destructive text-destructive-foreground rounded-full"
                      data-testid={`button-remove-photo-${idx}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {photos.length < 5 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-16 h-16"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    data-testid="button-add-photo"
                  >
                    {isUploadingPhoto ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <ImagePlus className="h-5 w-5" />
                    )}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Add up to 5 photos. AI will analyze them to suggest materials and labour.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
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
                          <p className="text-sm font-medium truncate">{item.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {getCategoryBadge(item.category)}
                            <span className="text-xs text-muted-foreground">
                              {item.quantity} × ${item.unitPrice.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <span className="font-medium">${item.total.toFixed(2)}</span>
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
                disabled={generateMutation.isPending || (!jobDescription.trim() && !voiceTranscription.trim() && photos.length === 0)}
                data-testid="button-generate-ai-quote"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
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
                  setJobDescription("");
                  setVoiceTranscription("");
                  setPhotos([]);
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
