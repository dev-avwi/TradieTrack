import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  FileText,
  Calendar,
  DollarSign,
  Camera,
  MapPin,
  Receipt,
  Star,
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
  },
  {
    field: "jobReminderEnabled",
    title: "Auto-confirm jobs 24h before",
    description: "Send reminder notifications before scheduled jobs",
    icon: Calendar,
    color: "142 76% 36%",
  },
  {
    field: "overdueInvoiceReminderEnabled",
    title: "Auto-chase overdue invoices",
    description: "Send payment reminders when invoices are past due",
    icon: DollarSign,
    color: "0 84% 60%",
  },
  {
    field: "photoRequirementsEnabled",
    title: "Require photos on job completion",
    description: "Prompt workers to take before/after photos when completing jobs",
    icon: Camera,
    color: "38 92% 50%",
  },
  {
    field: "gpsAutoCheckInEnabled",
    title: "GPS auto check-in/out",
    description: "Automatically start and stop timers when workers arrive at job sites",
    icon: MapPin,
    color: "270 70% 60%",
  },
  {
    field: "autoInvoiceOnComplete",
    title: "Auto-create invoice when job is done",
    description: "Automatically generate an invoice when a job is marked complete",
    icon: Receipt,
    color: "174 72% 40%",
  },
  {
    field: "autoReviewRequest",
    title: "Request reviews after payment",
    description: "Automatically ask clients for a review after they pay an invoice",
    icon: Star,
    color: "48 96% 53%",
  },
];

export default function Autopilot({ onNavigate }: AutopilotProps) {
  const { toast } = useToast();

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
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => handleToggle(item.field, checked)}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
