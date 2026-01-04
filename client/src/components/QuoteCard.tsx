import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, User, Calendar, ChevronRight, ArrowRight } from "lucide-react";
import StatusBadge from "./StatusBadge";
import XeroRibbon from "./XeroRibbon";

interface QuoteCardProps {
  id: string;
  number: string;
  client: string;
  jobTitle: string;
  total: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  validUntil?: string;
  sentAt?: string;
  isXeroImport?: boolean;
  onViewClick?: (id: string) => void;
  onSendClick?: (id: string) => void;
  onConvertToInvoice?: (id: string) => void;
}

export default function QuoteCard({ 
  id, 
  number, 
  client, 
  jobTitle, 
  total, 
  status, 
  validUntil,
  sentAt,
  isXeroImport,
  onViewClick, 
  onSendClick,
  onConvertToInvoice 
}: QuoteCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  return (
    <Card 
      className="hover-elevate active-elevate-2 cursor-pointer relative overflow-visible"
      style={{ borderRadius: '14px' }}
      onClick={() => onViewClick?.(id)}
      data-testid={`quote-card-${id}`}
    >
      {isXeroImport && <XeroRibbon size="sm" />}
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2.5">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
              >
                <FileText className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-[15px]">{number}</h3>
                  <StatusBadge status={status} />
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span className="truncate">{client}</span>
                </div>
              </div>
            </div>

            <div className="pl-12 space-y-1.5">
              <p className="text-sm font-medium line-clamp-1">{jobTitle}</p>
              
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {validUntil && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>Valid until {validUntil}</span>
                  </div>
                )}
                {sentAt && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>Sent {sentAt}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="text-right">
              <div className="text-lg font-bold" style={{ color: 'hsl(var(--trade))' }}>
                {formatCurrency(total)}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {status === 'draft' && (
                <Button 
                  size="xl"
                  onClick={(e) => { e.stopPropagation(); onSendClick?.(id); }}
                  data-testid={`button-send-quote-${id}`}
                >
                  Send
                </Button>
              )}
              
              {status === 'sent' && (
                <Button 
                  variant="outline"
                  size="xl"
                  onClick={(e) => { e.stopPropagation(); onSendClick?.(id); }}
                  data-testid={`button-resend-quote-${id}`}
                >
                  Resend
                </Button>
              )}
              
              {status === 'accepted' && (
                <Button 
                  size="xl"
                  onClick={(e) => { e.stopPropagation(); onConvertToInvoice?.(id); }}
                  data-testid={`button-invoice-quote-${id}`}
                >
                  <ArrowRight className="h-4 w-4 mr-1" />
                  Invoice
                </Button>
              )}
              
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
