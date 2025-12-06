import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, MapPin, Phone, Mail, Briefcase, ChevronRight } from "lucide-react";

interface ClientCardProps {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  jobsCount?: number;
  lastJobDate?: string;
  onView?: () => void;
  onCreateJob?: () => void;
  onCall?: () => void;
  onEmail?: () => void;
}

export default function ClientCard({ 
  id, 
  name, 
  email, 
  phone, 
  address, 
  jobsCount = 0,
  lastJobDate,
  onView, 
  onCreateJob,
  onCall,
  onEmail 
}: ClientCardProps) {
  return (
    <Card 
      className="hover-elevate active-elevate-2 cursor-pointer"
      style={{ borderRadius: '14px' }}
      onClick={onView}
      data-testid={`client-card-${id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
              >
                <User className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-[15px] line-clamp-1">{name}</h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {jobsCount} {jobsCount === 1 ? 'job' : 'jobs'}
                  </Badge>
                  {lastJobDate && (
                    <span>Last: {lastJobDate}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground pl-12">
              {email && (
                <Button 
                  variant="ghost"
                  size="xl"
                  className="text-primary text-xs"
                  onClick={(e) => { e.stopPropagation(); onEmail?.(); }}
                  data-testid={`button-email-client-${id}`}
                >
                  <Mail className="h-4 w-4 mr-1.5" />
                  <span className="truncate max-w-[150px]">{email}</span>
                </Button>
              )}
              
              {phone && (
                <Button 
                  variant="ghost"
                  size="xl"
                  className="text-primary text-xs"
                  onClick={(e) => { e.stopPropagation(); onCall?.(); }}
                  data-testid={`button-call-client-${id}`}
                >
                  <Phone className="h-4 w-4 mr-1.5" />
                  <span>{phone}</span>
                </Button>
              )}
              
              {address && (
                <div className="flex items-center gap-1.5 min-h-[44px] px-3">
                  <MapPin className="h-4 w-4" />
                  <span className="truncate max-w-[150px]">{address}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button 
              size="xl"
              onClick={(e) => { e.stopPropagation(); onCreateJob?.(); }}
              data-testid={`button-new-job-client-${id}`}
            >
              <Briefcase className="h-4 w-4 mr-1.5" />
              Job
            </Button>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
