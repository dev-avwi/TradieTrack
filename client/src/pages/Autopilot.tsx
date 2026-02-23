import { useState, useCallback, useRef, useEffect, type ComponentProps, type ChangeEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageShell, PageHeader, SectionTitle } from "@/components/ui/page-shell";
import {
  FileText,
  Calendar,
  DollarSign,
  Camera,
  MapPin,
  Receipt,
  Star,
  Zap,
  Plus,
  Settings,
  TrendingUp,
} from "lucide-react";

interface AutopilotProps {
  onNavigate?: (path: string) => void;
}

interface AutomationSettings {
  quoteFollowUpEnabled?: boolean;
  quoteFollowUpDays?: number;
  quoteFollowUpType?: string;
  quoteFollowUpMessage?: string;
  jobReminderEnabled?: boolean;
  jobReminderHoursBefore?: number;
  jobReminderType?: string;
  jobReminderMessage?: string;
  invoiceReminderEnabled?: boolean;
  invoiceReminderDaysBeforeDue?: number;
  invoiceOverdueReminderDays?: number;
  invoiceReminderType?: string;
  invoiceReminderMessage?: string;
  photoRequirementsEnabled?: boolean;
  requirePhotoBeforeStart?: boolean;
  requirePhotoAfterComplete?: boolean;
  gpsAutoCheckInEnabled?: boolean;
  autoCheckInOnArrival?: boolean;
  autoCheckOutOnDeparture?: boolean;
  autoInvoiceOnComplete?: boolean;
  autoReviewRequest?: boolean;
  autoReviewRequestType?: string;
  reviewRequestMessage?: string;
  [key: string]: boolean | number | string | undefined;
}

const DEFAULT_MESSAGES = {
  quoteFollowUpMessage: "Hi {client}, just following up on quote #{number} for {amount} we sent on {date}. Let us know if you have any questions or would like to go ahead.",
  jobReminderMessage: "Hi {client}, confirming your {jobType} appointment tomorrow at {time} at {address}. Reply YES to confirm or call us to reschedule.",
  invoiceReminderMessage: "Hi {client}, invoice #{number} for {amount} was due on {date}. Please arrange payment at your earliest convenience.",
  reviewRequestMessage: "Hi {client}, thanks for choosing {business}! We'd love to hear how we did. Your feedback helps us improve!",
};

const TEMPLATE_VARIABLES: Record<string, string[]> = {
  quoteFollowUpMessage: ["{client}", "{number}", "{amount}", "{date}"],
  jobReminderMessage: ["{client}", "{jobType}", "{time}", "{address}"],
  invoiceReminderMessage: ["{client}", "{number}", "{amount}", "{date}"],
  reviewRequestMessage: ["{client}", "{business}"],
};

type AutomationField = "quoteFollowUpEnabled" | "jobReminderEnabled" | "invoiceReminderEnabled" | "photoRequirementsEnabled" | "gpsAutoCheckInEnabled" | "autoInvoiceOnComplete" | "autoReviewRequest";

const ENABLE_DEFAULTS: Partial<Record<AutomationField, Partial<AutomationSettings>>> = {
  quoteFollowUpEnabled: { quoteFollowUpDays: 3, quoteFollowUpType: "email", quoteFollowUpMessage: DEFAULT_MESSAGES.quoteFollowUpMessage },
  jobReminderEnabled: { jobReminderHoursBefore: 24, jobReminderType: "sms", jobReminderMessage: DEFAULT_MESSAGES.jobReminderMessage },
  invoiceReminderEnabled: { invoiceReminderDaysBeforeDue: 3, invoiceOverdueReminderDays: 7, invoiceReminderType: "email", invoiceReminderMessage: DEFAULT_MESSAGES.invoiceReminderMessage },
  photoRequirementsEnabled: { requirePhotoBeforeStart: true, requirePhotoAfterComplete: true },
  gpsAutoCheckInEnabled: { autoCheckInOnArrival: true, autoCheckOutOnDeparture: true },
  autoReviewRequest: { autoReviewRequestType: "email", reviewRequestMessage: DEFAULT_MESSAGES.reviewRequestMessage },
};

interface AutomationConfig {
  field: AutomationField;
  title: string;
  subtitle: string;
  icon: typeof FileText;
  color: string;
  category: "communications" | "fieldwork" | "billing";
}

const automations: AutomationConfig[] = [
  {
    field: "quoteFollowUpEnabled",
    title: "Quote Follow-up",
    subtitle: "Sends follow-up after quote is sent with no response",
    icon: FileText,
    color: "210 100% 50%",
    category: "communications",
  },
  {
    field: "jobReminderEnabled",
    title: "Job Reminder",
    subtitle: "Sends confirmation before scheduled job start time",
    icon: Calendar,
    color: "142 76% 36%",
    category: "communications",
  },
  {
    field: "invoiceReminderEnabled",
    title: "Invoice Reminders",
    subtitle: "Sends payment reminders before due and when overdue",
    icon: DollarSign,
    color: "0 84% 60%",
    category: "billing",
  },
  {
    field: "photoRequirementsEnabled",
    title: "Photo Requirements",
    subtitle: "Prompts workers for before/after photos on jobs",
    icon: Camera,
    color: "38 92% 50%",
    category: "fieldwork",
  },
  {
    field: "gpsAutoCheckInEnabled",
    title: "GPS Auto Check-in",
    subtitle: "Auto start/stop timers at job sites via GPS",
    icon: MapPin,
    color: "270 70% 60%",
    category: "fieldwork",
  },
  {
    field: "autoInvoiceOnComplete",
    title: "Auto-invoice on Complete",
    subtitle: "Creates invoice automatically when job is completed",
    icon: Receipt,
    color: "174 72% 40%",
    category: "billing",
  },
  {
    field: "autoReviewRequest",
    title: "Review Request",
    subtitle: "Requests a review after invoice payment is confirmed",
    icon: Star,
    color: "48 96% 53%",
    category: "communications",
  },
];

function DebouncedTextarea({
  value: externalValue,
  onChange,
  ...props
}: { value: string; onChange: (v: string) => void } & Omit<ComponentProps<typeof Textarea>, 'value' | 'onChange'>) {
  const [localValue, setLocalValue] = useState(externalValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setLocalValue(externalValue); }, [externalValue]);
  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setLocalValue(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), 800);
  }, [onChange]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  return <Textarea {...props} value={localValue} onChange={handleChange} />;
}

function DebouncedNumberInput({
  value: externalValue,
  onChange,
  ...props
}: { value: number; onChange: (v: number) => void } & Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'>) {
  const [localValue, setLocalValue] = useState(String(externalValue));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setLocalValue(String(externalValue)); }, [externalValue]);
  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocalValue(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(parseInt(v) || 1), 600);
  }, [onChange]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  return <Input {...props} type="number" value={localValue} onChange={handleChange} />;
}

function ChannelSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1">
      {(["sms", "email", "both"] as const).map((ch) => (
        <Button
          key={ch}
          size="sm"
          variant={value === ch ? "default" : "outline"}
          onClick={() => onChange(ch)}
        >
          {ch === "sms" ? "SMS" : ch === "email" ? "Email" : "Both"}
        </Button>
      ))}
    </div>
  );
}

function InlineSettings({
  field,
  settings,
  onUpdate,
}: {
  field: AutomationField;
  settings: AutomationSettings;
  onUpdate: (changes: Partial<AutomationSettings>) => void;
}) {
  if (field === "quoteFollowUpEnabled") {
    const days = settings.quoteFollowUpDays ?? 3;
    const channel = settings.quoteFollowUpType ?? "email";
    const message = settings.quoteFollowUpMessage ?? DEFAULT_MESSAGES.quoteFollowUpMessage;
    return (
      <div className="flex flex-col gap-3 pt-3 border-t border-border/50">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Follow-up delay (days)</Label>
          <DebouncedNumberInput
            min={1}
            value={days}
            onChange={(v) => onUpdate({ quoteFollowUpDays: v })}
            className="w-24"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Channel</Label>
          <ChannelSelector value={channel} onChange={(v) => onUpdate({ quoteFollowUpType: v })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Message template</Label>
          <DebouncedTextarea
            value={message}
            onChange={(v) => onUpdate({ quoteFollowUpMessage: v })}
            rows={3}
            className="text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Variables: {TEMPLATE_VARIABLES.quoteFollowUpMessage.join(", ")}
          </p>
        </div>
      </div>
    );
  }

  if (field === "jobReminderEnabled") {
    const hours = settings.jobReminderHoursBefore ?? 24;
    const channel = settings.jobReminderType ?? "sms";
    const message = settings.jobReminderMessage ?? DEFAULT_MESSAGES.jobReminderMessage;
    return (
      <div className="flex flex-col gap-3 pt-3 border-t border-border/50">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Hours before job</Label>
          <DebouncedNumberInput
            min={1}
            value={hours}
            onChange={(v) => onUpdate({ jobReminderHoursBefore: v })}
            className="w-24"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Channel</Label>
          <ChannelSelector value={channel} onChange={(v) => onUpdate({ jobReminderType: v })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Message template</Label>
          <DebouncedTextarea
            value={message}
            onChange={(v) => onUpdate({ jobReminderMessage: v })}
            rows={3}
            className="text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Variables: {TEMPLATE_VARIABLES.jobReminderMessage.join(", ")}
          </p>
        </div>
      </div>
    );
  }

  if (field === "invoiceReminderEnabled") {
    const daysBefore = settings.invoiceReminderDaysBeforeDue ?? 3;
    const overdueInterval = settings.invoiceOverdueReminderDays ?? 7;
    const channel = settings.invoiceReminderType ?? "email";
    const message = settings.invoiceReminderMessage ?? DEFAULT_MESSAGES.invoiceReminderMessage;
    return (
      <div className="flex flex-col gap-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Days before due</Label>
            <DebouncedNumberInput
              min={1}
              value={daysBefore}
              onChange={(v) => onUpdate({ invoiceReminderDaysBeforeDue: v })}
              className="w-24"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Overdue repeat interval (days)</Label>
            <DebouncedNumberInput
              min={1}
              value={overdueInterval}
              onChange={(v) => onUpdate({ invoiceOverdueReminderDays: v })}
              className="w-24"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Channel</Label>
          <ChannelSelector value={channel} onChange={(v) => onUpdate({ invoiceReminderType: v })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Message template</Label>
          <DebouncedTextarea
            value={message}
            onChange={(v) => onUpdate({ invoiceReminderMessage: v })}
            rows={3}
            className="text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Variables: {TEMPLATE_VARIABLES.invoiceReminderMessage.join(", ")}
          </p>
        </div>
      </div>
    );
  }

  if (field === "photoRequirementsEnabled") {
    const beforeStart = settings.requirePhotoBeforeStart ?? true;
    const afterComplete = settings.requirePhotoAfterComplete ?? true;
    return (
      <div className="flex flex-col gap-3 pt-3 border-t border-border/50">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm">Require photo before start</Label>
          <Switch
            checked={beforeStart}
            onCheckedChange={(checked) => onUpdate({ requirePhotoBeforeStart: checked })}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm">Require photo after complete</Label>
          <Switch
            checked={afterComplete}
            onCheckedChange={(checked) => onUpdate({ requirePhotoAfterComplete: checked })}
          />
        </div>
      </div>
    );
  }

  if (field === "gpsAutoCheckInEnabled") {
    const checkIn = settings.autoCheckInOnArrival ?? true;
    const checkOut = settings.autoCheckOutOnDeparture ?? true;
    return (
      <div className="flex flex-col gap-3 pt-3 border-t border-border/50">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm">Auto check-in on arrival</Label>
          <Switch
            checked={checkIn}
            onCheckedChange={(checked) => onUpdate({ autoCheckInOnArrival: checked })}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm">Auto check-out on departure</Label>
          <Switch
            checked={checkOut}
            onCheckedChange={(checked) => onUpdate({ autoCheckOutOnDeparture: checked })}
          />
        </div>
      </div>
    );
  }

  if (field === "autoReviewRequest") {
    const channel = settings.autoReviewRequestType ?? "email";
    const message = settings.reviewRequestMessage ?? DEFAULT_MESSAGES.reviewRequestMessage;
    return (
      <div className="flex flex-col gap-3 pt-3 border-t border-border/50">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Channel</Label>
          <ChannelSelector value={channel} onChange={(v) => onUpdate({ autoReviewRequestType: v })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Message template</Label>
          <DebouncedTextarea
            value={message}
            onChange={(v) => onUpdate({ reviewRequestMessage: v })}
            rows={3}
            className="text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Variables: {TEMPLATE_VARIABLES.reviewRequestMessage.join(", ")}
          </p>
        </div>
      </div>
    );
  }

  return null;
}

const categoryLabels: Record<string, { label: string; icon: typeof Settings }> = {
  communications: { label: "Communications", icon: FileText },
  fieldwork: { label: "Fieldwork", icon: MapPin },
  billing: { label: "Billing", icon: DollarSign },
};

export default function Autopilot({ onNavigate }: AutopilotProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"all" | "communications" | "fieldwork" | "billing">("all");

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

  const handleUpdate = (changes: Partial<AutomationSettings>) => {
    const updated = { ...settings, ...changes };
    mutation.mutate(updated);
  };

  const activeCount = settings
    ? automations.filter((a) => settings[a.field]).length
    : 0;

  const filteredAutomations = activeTab === "all"
    ? automations
    : automations.filter((a) => a.category === activeTab);

  const tabs = [
    { key: "all" as const, label: "All" },
    { key: "communications" as const, label: "Comms" },
    { key: "fieldwork" as const, label: "Fieldwork" },
    { key: "billing" as const, label: "Billing" },
  ];

  if (isLoading) {
    return (
      <PageShell>
        <div className="animate-fade-up">
          <Skeleton className="h-10 w-40 mb-2" />
          <Skeleton className="h-4 w-64 mb-6" />
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-full rounded-2xl mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      </PageShell>
    );
  }

  const hasAnyActive = activeCount > 0;

  return (
    <PageShell>
      <div className="animate-fade-up">
        <PageHeader
          title="Autopilot"
          subtitle="Automations that kill admin work"
          leading={<Zap className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />}
          action={
            <Badge variant="secondary" className="text-xs">
              {activeCount}/{automations.length} active
            </Badge>
          }
        />
      </div>

      <div className="animate-fade-up stagger-delay-1">
        <div className="grid grid-cols-3 gap-3">
          <div className="feed-card p-4 animate-fade-up stagger-delay-1">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
                <Zap className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              </div>
            </div>
            <p className="text-[22px] font-bold tracking-tight">{activeCount}</p>
            <p className="ios-caption">Active</p>
          </div>
          <div className="feed-card p-4 animate-fade-up stagger-delay-2">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ backgroundColor: 'hsl(142 76% 36% / 0.1)' }}>
                <TrendingUp className="h-5 w-5" style={{ color: 'hsl(142 76% 36%)' }} />
              </div>
            </div>
            <p className="text-[22px] font-bold tracking-tight">{automations.length - activeCount}</p>
            <p className="ios-caption">Available</p>
          </div>
          <div className="feed-card p-4 animate-fade-up stagger-delay-3">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ backgroundColor: 'hsl(270 70% 60% / 0.1)' }}>
                <Settings className="h-5 w-5" style={{ color: 'hsl(270 70% 60%)' }} />
              </div>
            </div>
            <p className="text-[22px] font-bold tracking-tight">{automations.length}</p>
            <p className="ios-caption">Total</p>
          </div>
        </div>
      </div>

      <div className="animate-fade-up stagger-delay-2">
        <div className="feed-card p-1.5">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 min-w-0 px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-foreground text-background"
                    : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hasAnyActive && activeTab === "all" && (
        <div className="animate-fade-up stagger-delay-3">
          <div className="card-accent p-8 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                 style={{
                   background: `linear-gradient(135deg, hsl(var(--trade) / 0.15), hsl(var(--trade) / 0.05))`,
                 }}>
              <Zap className="h-10 w-10 animate-pulse-soft" style={{ color: 'hsl(var(--trade))' }} />
            </div>
            <h3 className="text-[17px] font-semibold tracking-tight mb-1">Put your business on autopilot</h3>
            <p className="ios-caption max-w-xs mb-5">
              Automate follow-ups, reminders, invoicing and more. Save hours every week and never miss a beat.
            </p>
            <Button onClick={() => setActiveTab("all")}>
              <Plus className="h-4 w-4 mr-1.5" />
              Enable your first automation
            </Button>
          </div>
        </div>
      )}

      <div>
        <SectionTitle className="mb-3">
          {activeTab === "all" ? "All Automations" : categoryLabels[activeTab]?.label || "Automations"}
        </SectionTitle>

        <div className="space-y-3">
          {filteredAutomations.map((item, index) => {
            const Icon = item.icon;
            const isEnabled = !!settings?.[item.field];
            const hasInlineSettings = item.field !== "autoInvoiceOnComplete";

            return (
              <div
                key={item.field}
                className={`feed-card card-press animate-fade-up stagger-delay-${Math.min(index + 1, 8)}`}
              >
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `hsl(${item.color} / 0.1)` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: `hsl(${item.color})` }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="ios-card-title">{item.title}</p>
                        {isEnabled && (
                          <Badge variant="secondary" className="text-[10px]">
                            ON
                          </Badge>
                        )}
                      </div>
                      <p className="ios-caption mt-0.5">{item.subtitle}</p>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) => {
                        const defaults = checked && ENABLE_DEFAULTS[item.field] ? ENABLE_DEFAULTS[item.field] : {};
                        handleUpdate({ [item.field]: checked, ...defaults });
                      }}
                    />
                  </div>
                  {isEnabled && hasInlineSettings && (
                    <div className="mt-3 rounded-xl bg-muted/30 p-3">
                      <InlineSettings
                        field={item.field}
                        settings={settings || {}}
                        onUpdate={handleUpdate}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}
