import { useRef, useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Pen, Trash2, Check, X, RotateCcw } from 'lucide-react';
import type { JobSignature } from '@shared/schema';

interface SignatureCaptureProps {
  jobId: string;
  onSignatureAdded?: () => void;
}

export function SignatureCapture({ jobId, onSignatureAdded }: SignatureCaptureProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerRole, setSignerRole] = useState('customer');
  const [signatureType, setSignatureType] = useState<'customer' | 'technician'>('customer');
  const [notes, setNotes] = useState('');

  const { data: signatures = [], isLoading } = useQuery<JobSignature[]>({
    queryKey: ['/api/jobs', jobId, 'signatures'],
  });

  const createSignatureMutation = useMutation({
    mutationFn: async (data: { signatureData: string; signerName: string; signatureType: string; signerRole?: string; notes?: string }) => {
      return apiRequest('POST', `/api/jobs/${jobId}/signatures`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'signatures'] });
      toast({
        title: 'Signature captured',
        description: 'The signature has been saved successfully.',
      });
      setDialogOpen(false);
      clearCanvas();
      setSignerName('');
      setSignerRole('customer');
      setNotes('');
      onSignatureAdded?.();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save signature',
        variant: 'destructive',
      });
    },
  });

  const deleteSignatureMutation = useMutation({
    mutationFn: async (signatureId: string) => {
      return apiRequest('DELETE', `/api/jobs/${jobId}/signatures/${signatureId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'signatures'] });
      toast({
        title: 'Signature deleted',
        description: 'The signature has been removed.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete signature',
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (dialogOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [dialogOpen]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSaveSignature = () => {
    if (!signerName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter the signer\'s name.',
        variant: 'destructive',
      });
      return;
    }

    if (!hasDrawn) {
      toast({
        title: 'Signature required',
        description: 'Please draw a signature before saving.',
        variant: 'destructive',
      });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const signatureData = canvas.toDataURL('image/png');
    
    createSignatureMutation.mutate({
      signatureData,
      signerName: signerName.trim(),
      signatureType,
      signerRole: signerRole || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <Card data-testid="card-signatures-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pen className="h-5 w-5" />
            Signatures
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-signatures">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Pen className="h-5 w-5" />
              Signatures
            </CardTitle>
            <CardDescription>
              Capture customer and technician signatures
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-signature">
                <Pen className="h-4 w-4 mr-2" />
                Add Signature
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Capture Signature</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="signerName">Signer Name *</Label>
                    <Input
                      id="signerName"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder="Enter name"
                      data-testid="input-signer-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signatureType">Type</Label>
                    <Select value={signatureType} onValueChange={(v) => setSignatureType(v as 'customer' | 'technician')}>
                      <SelectTrigger data-testid="select-signature-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="technician">Technician</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signerRole">Role / Title (optional)</Label>
                  <Input
                    id="signerRole"
                    value={signerRole}
                    onChange={(e) => setSignerRole(e.target.value)}
                    placeholder="e.g., Property Manager, Home Owner"
                    data-testid="input-signer-role"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Signature</Label>
                  <div className="border rounded-lg p-2 bg-white">
                    <canvas
                      ref={canvasRef}
                      width={400}
                      height={150}
                      className="w-full border rounded cursor-crosshair touch-none"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      data-testid="canvas-signature"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearCanvas}
                    className="mt-2"
                    data-testid="button-clear-signature"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes..."
                    rows={2}
                    data-testid="input-signature-notes"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-signature">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveSignature}
                    disabled={createSignatureMutation.isPending}
                    data-testid="button-save-signature"
                  >
                    {createSignatureMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Save Signature
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {signatures.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Pen className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No signatures captured yet</p>
            <p className="text-sm">Capture customer signature on job completion</p>
          </div>
        ) : (
          <div className="space-y-4">
            {signatures.map((signature) => (
              <div
                key={signature.id}
                className="border rounded-lg p-4 space-y-3"
                data-testid={`signature-item-${signature.id}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{signature.signerName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        signature.signatureType === 'customer' 
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                          : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                      }`}>
                        {signature.signatureType === 'customer' ? 'Customer' : 'Technician'}
                      </span>
                    </div>
                    {signature.signerRole && (
                      <p className="text-sm text-muted-foreground">{signature.signerRole}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(signature.createdAt!)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteSignatureMutation.mutate(signature.id)}
                    disabled={deleteSignatureMutation.isPending}
                    data-testid={`button-delete-signature-${signature.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="bg-white rounded border p-2">
                  <img
                    src={signature.signatureData}
                    alt={`Signature by ${signature.signerName}`}
                    className="max-h-24 mx-auto"
                  />
                </div>
                {signature.notes && (
                  <p className="text-sm text-muted-foreground">{signature.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SignatureCapture;
