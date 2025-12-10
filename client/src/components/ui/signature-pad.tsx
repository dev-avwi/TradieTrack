import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser, Check, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SignaturePadProps {
  onSave?: (signatureData: string) => void;
  onClear?: () => void;
  initialValue?: string;
  width?: number;
  height?: number;
  className?: string;
  strokeColor?: string;
  strokeWidth?: number;
  disabled?: boolean;
  showControls?: boolean;
}

export function SignaturePad({
  onSave,
  onClear,
  initialValue,
  width = 400,
  height = 200,
  className,
  strokeColor = '#000000',
  strokeWidth = 2,
  disabled = false,
  showControls = true,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
    return ctx;
  }, [strokeColor, strokeWidth]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onClear?.();
  }, [getContext, onClear]);

  const loadInitialValue = useCallback(() => {
    if (!initialValue || !canvasRef.current) return;
    const ctx = getContext();
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      setHasSignature(true);
    };
    img.src = initialValue;
  }, [initialValue, getContext]);

  useEffect(() => {
    loadInitialValue();
  }, [loadInitialValue]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      if (!touch) return null;
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;

    setIsDrawing(true);
    lastPointRef.current = coords;
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();

    const coords = getCoordinates(e);
    const ctx = getContext();
    const lastPoint = lastPointRef.current;

    if (!coords || !ctx || !lastPoint) return;

    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    lastPointRef.current = coords;
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPointRef.current = null;
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;
    
    const signatureData = canvas.toDataURL('image/png');
    onSave?.(signatureData);
  };

  const getSignatureData = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return null;
    return canvas.toDataURL('image/png');
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div 
        className={cn(
          'relative border-2 border-dashed rounded-lg bg-white dark:bg-gray-900 overflow-hidden',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-crosshair',
          hasSignature ? 'border-primary' : 'border-muted-foreground/30'
        )}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full touch-none"
          style={{ maxWidth: width, aspectRatio: `${width}/${height}` }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasSignature && !disabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-muted-foreground/50">
            <span className="text-sm">Sign here</span>
          </div>
        )}
      </div>

      {showControls && (
        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearCanvas}
            disabled={disabled || !hasSignature}
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Clear
          </Button>
          {onSave && (
            <Button
              type="button"
              size="sm"
              onClick={saveSignature}
              disabled={disabled || !hasSignature}
            >
              <Check className="w-4 h-4 mr-1" />
              Save Signature
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function SignatureDisplay({ 
  signatureData, 
  className,
  label = 'Signature'
}: { 
  signatureData: string; 
  className?: string;
  label?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="border rounded-lg p-2 bg-white dark:bg-gray-900">
        <img 
          src={signatureData} 
          alt="Signature" 
          className="max-h-16 w-auto"
        />
      </div>
    </div>
  );
}
