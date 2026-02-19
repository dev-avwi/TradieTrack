import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  Calendar,
  DollarSign,
  Camera,
  MapPin,
  Receipt,
  Star,
  Info,
} from "lucide-react";

interface AutopilotProps {
  onNavigate?: (path: string) => void;
}

interface AutomationSettings {
  quoteFollowUpEnabled?: boolean;
  jobReminderEnabled?: boolean;
  overdueInvoiceReminderEnabled?: boolean;
  photoRequirementsEnabled?: boolean;
  gpsAutoCheckInEnabled?: boolean;
  autoInvoiceOnComplete?: boolean;
  autoReviewRequest?: boolean;
  [key: string]: boolean | undefined;
}

const automations = [
  {
    field: "quoteFollowUpEnabled",
    title: "Auto-remind quotes after 7 days",
    description: "Automatically follow up on quotes that haven't been responded to",
    icon: FileText,
    color: "210 100% 50%",
    howItWorks: "When a quote is sent and the client hasn't responded after 7 days, an automatic follow-up email or SMS is sent reminding them about the quote.",
    example: "Hi [Client], just following up on quote #QT-001 for $2,500 we sent on [date]. Let us know if you have any questions or would like to go ahead.",
    trigger: "7 days after quote is sent with no response",
  },
  {
    field: "jobReminderEnabled",
    title: "Auto-confirm jobs 24h before",
    description: "Send reminder notifications before scheduled jobs",
    icon: Calendar,
    color: "142 76% 36%",
    howItWorks: "24 hours before a scheduled job, an automatic confirmation message is sent to the client with the job details, time, and address.",
    example: "Hi [Client], just confirming your [job type] appointment tomorrow at [time] at [address]. Reply YES to confirm or call us to reschedule.",
    trigger: "24 hours before scheduled job start time",
  },
  {
    field: "overdueInvoiceReminderEnabled",
    title: "Auto-chase overdue invoices",
    description: "Send payment reminders when invoices are past due",
    icon: DollarSign,
    color: "0 84% 60%",
    howItWorks: "When an invoice passes its due date, automatic payment reminders are sent at increasing intervals until the invoice is paid.",
    example: "Hi [Client], invoice #INV-001 for $1,200 was due on [date]. Please arrange payment at your earliest convenience. Pay online: [link]",
    trigger: "When invoice is overdue, repeats at 3, 7, 14 day intervals",
  },
  {
    field: "photoRequirementsEnabled",
    title: "Require photos on job completion",
    description: "Prompt workers to take before/after photos when completing jobs",
    icon: Camera,
    color: "38 92% 50%",
    howItWorks: "When a worker tries to mark a job as complete, they're prompted to take before and after photos. The job can't be completed without the required photos.",
    example: "Workers see a photo capture screen with prompts for 'Before' and 'After' shots before the Complete button becomes active.",
    trigger: "When worker attempts to complete a job",
  },
  {
    field: "gpsAutoCheckInEnabled",
    title: "GPS auto check-in/out",
    description: "Automatically start and stop timers when workers arrive at job sites",
    icon: MapPin,
    color: "270 70% 60%",
    howItWorks: "Using GPS geofencing, the system detects when a worker arrives at or leaves a job site and automatically starts or stops their time tracker.",
    example: "Worker arrives within 100m of job site \u2192 Timer starts automatically. Worker leaves the area \u2192 Timer pauses with a notification.",
    trigger: "Worker enters or exits job site geofence",
  },
  {
    field: "autoInvoiceOnComplete",
    title: "Auto-create invoice when job is done",
    description: "Automatically generate an invoice when a job is marked complete",
    icon: Receipt,
    color: "174 72% 40%",
    howItWorks: "When a job is marked as complete, an invoice is automatically generated using the quote line items, time tracked, and materials logged on the job.",
    example: "Job completed \u2192 Invoice #INV-042 created for $3,450 including 12hrs labour + materials. Ready to send to client.",
    trigger: "When job status changes to 'Completed'",
  },
  {
    field: "autoReviewRequest",
    title: "Request reviews after payment",
    description: "Automatically ask clients for a review after they pay an invoice",
    icon: Star,
    color: "48 96% 53%",
    howItWorks: "After a client pays an invoice, a friendly review request is automatically sent via email asking them to leave feedback about the work.",
    example: "Hi [Client], thanks for your payment! We'd love to hear how we did. Leave a quick review: [link]. Your feedback helps us improve!",
    trigger: "After invoice payment is confirmed",
  },
];

export default function Autopilot({ onNavigate }: AutopilotProps) {
  const { toast } = useToast();
  const [selectedAutomation, setSelectedAutomation] = useState<typeof automations[number] | null>(null);

  const { data: settings, isLoading } = useQuery<AutomationSettings>({
    queryKey: ["/api/automation-settings"],
  });

  const mutation = useMutation({
    mutationFn: async (updated: AutomationSettings) => {
      const res = await apiRequest("PUT", "/api/automation-settings", updated);
      return res.json();
    },
    onMutate: async (updated) => {
      await queryClient.cancelQueries({ queryKey: ["/api/automation-settings"] });
      const previous = queryClient.getQueryData<AutomationSettings>(["/api/automation-settings"]);
      queryClient.setQueryData(["/api/automation-settings"], updated);
      return { previous };
    },
    onError: (_err, _updated, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/automation-settings"], context.previous);
      }
      toast({ title: "Error", description: "Failed to save setting", variant: "destructive" });
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Automation setting updated" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation-settings"] });
    },
  });

  const handleToggle = (field: string, checked: boolean) => {
    const updated = { ...settings, [field]: checked };
    mutation.mutate(updated);
  };

  const activeCount = settings
    ? automations.filter((a) => settings[a.field]).length
    : 0;

  if (isLoading) {
    return (
      <div className="w-full px-4 sm:px-6 py-4">
        <div className="mb-5">
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 py-4">
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Autopilot</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Automations that kill admin work</p>
        </div>
        <Badge variant="secondary">{activeCount} active</Badge>
      </div>

      <div className="flex flex-col gap-3">
        {automations.map((item) => {
          const Icon = item.icon;
          const isEnabled = !!settings?.[item.field];

          return (
            <Card key={item.field}>
              <CardContent className="flex items-center gap-3 p-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `hsl(${item.color} / 0.1)` }}
                >
                  <Icon className="h-5 w-5" style={{ color: `hsl(${item.color})` }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setSelectedAutomation(item)}
                >
                  <Info className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => handleToggle(item.field, checked)}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selectedAutomation} onOpenChange={(open) => !open && setSelectedAutomation(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAutomation && (
                <>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `hsl(${selectedAutomation.color} / 0.1)` }}
                  >
                    {(() => { const DialogIcon = selectedAutomation.icon; return <DialogIcon className="h-4 w-4" style={{ color: `hsl(${selectedAutomation.color})` }} />; })()}
                  </div>
                  {selectedAutomation.title}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedAutomation && (
            <div className="flex flex-col gap-4">
              <div>
                <h4 className="text-sm font-medium text-foreground mb-1">How it works</h4>
                <p className="text-sm text-muted-foreground">{selectedAutomation.howItWorks}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-foreground mb-1">Trigger</h4>
                <p className="text-sm text-muted-foreground">{selectedAutomation.trigger}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-foreground mb-1">Example</h4>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-sm text-muted-foreground italic">{selectedAutomation.example}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
