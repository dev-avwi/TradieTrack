import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, isToday, parseISO, isSameDay } from "date-fns";
import type { StaffAvailability, StaffTimeOff, TeamMember } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageShell } from "@/components/layout/PageShell";
import KPIBox from "@/components/KPIBox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  UserCheck,
  Clock,
  CalendarOff,
  Calendar,
  Edit,
  Check,
  X,
  MoreVertical,
  Plus,
  Coffee,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

const WEEK_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const TIME_OFF_TYPES = [
  { value: "leave", label: "Annual Leave" },
  { value: "sick", label: "Sick Leave" },
  { value: "personal", label: "Personal Leave" },
  { value: "holiday", label: "Holiday" },
];

const availabilityFormSchema = z.object({
  userId: z.string().min(1, "Staff member is required"),
  dayOfWeek: z.coerce.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  isAvailable: z.boolean(),
  breakStartTime: z.string().optional().nullable(),
  breakEndTime: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type AvailabilityFormData = z.infer<typeof availabilityFormSchema>;

const timeOffFormSchema = z.object({
  userId: z.string().min(1, "Staff member is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  type: z.enum(["leave", "sick", "personal", "holiday"]),
  reason: z.string().optional().nullable(),
});

type TimeOffFormData = z.infer<typeof timeOffFormSchema>;

function getDayLabel(dayOfWeek: number): string {
  return DAYS_OF_WEEK.find(d => d.value === dayOfWeek)?.label || "";
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "approved":
      return "default";
    case "rejected":
      return "destructive";
    case "pending":
    default:
      return "secondary";
  }
}

function getTypeLabel(type: string) {
  return TIME_OFF_TYPES.find(t => t.value === type)?.label || type;
}

interface StaffMemberWithAvailability {
  id: string;
  name: string;
  email: string;
  availability: Map<number, StaffAvailability>;
}

export default function StaffRostering() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("schedule");
  const [timeOffFilter, setTimeOffFilter] = useState("all");
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false);
  const [timeOffDialogOpen, setTimeOffDialogOpen] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState<StaffAvailability | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number | null>(null);

  const { data: teamMembers = [], isLoading: membersLoading } = useQuery<TeamMember[]>({
    queryKey: ['/api/team/members'],
  });

  const { data: availability = [], isLoading: availabilityLoading } = useQuery<StaffAvailability[]>({
    queryKey: ['/api/staff/availability'],
  });

  const { data: timeOffRequests = [], isLoading: timeOffLoading } = useQuery<StaffTimeOff[]>({
    queryKey: ['/api/staff/time-off'],
  });

  const activeMembers = useMemo(() => 
    teamMembers.filter(m => m.inviteStatus === 'accepted' && m.isActive),
    [teamMembers]
  );

  const staffWithAvailability = useMemo<StaffMemberWithAvailability[]>(() => {
    return activeMembers.map(member => {
      const memberAvail = availability.filter(a => a.userId === member.memberId);
      const availMap = new Map<number, StaffAvailability>();
      memberAvail.forEach(a => availMap.set(a.dayOfWeek, a));
      
      return {
        id: member.memberId || member.id,
        name: `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email,
        email: member.email,
        availability: availMap,
      };
    });
  }, [activeMembers, availability]);

  const todayDayOfWeek = new Date().getDay();
  
  const kpiStats = useMemo(() => {
    const totalStaff = activeMembers.length;
    
    const availableToday = staffWithAvailability.filter(staff => {
      const todayAvail = staff.availability.get(todayDayOfWeek);
      return todayAvail?.isAvailable === true;
    }).length;

    const today = new Date();
    const onLeaveToday = timeOffRequests.filter(r => {
      if (r.status !== 'approved') return false;
      const start = new Date(r.startDate);
      const end = new Date(r.endDate);
      return today >= start && today <= end;
    }).length;

    const pendingRequests = timeOffRequests.filter(r => r.status === 'pending').length;

    return { totalStaff, availableToday, pendingRequests, onLeaveToday };
  }, [activeMembers, staffWithAvailability, timeOffRequests, todayDayOfWeek]);

  const filteredTimeOff = useMemo(() => {
    if (timeOffFilter === "all") return timeOffRequests;
    return timeOffRequests.filter(r => r.status === timeOffFilter);
  }, [timeOffRequests, timeOffFilter]);

  const availabilityForm = useForm<AvailabilityFormData>({
    resolver: zodResolver(availabilityFormSchema),
    defaultValues: {
      userId: "",
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "17:00",
      isAvailable: true,
      breakStartTime: null,
      breakEndTime: null,
      notes: null,
    },
  });

  const timeOffForm = useForm<TimeOffFormData>({
    resolver: zodResolver(timeOffFormSchema),
    defaultValues: {
      userId: "",
      startDate: "",
      endDate: "",
      type: "leave",
      reason: null,
    },
  });

  const createAvailabilityMutation = useMutation({
    mutationFn: async (data: AvailabilityFormData) => {
      const response = await apiRequest("POST", "/api/staff/availability", {
        ...data,
        breakStartTime: data.breakStartTime || null,
        breakEndTime: data.breakEndTime || null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff/availability'] });
      toast({ title: "Availability saved", description: "Staff schedule has been updated" });
      handleCloseAvailabilityDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateAvailabilityMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AvailabilityFormData> }) => {
      const response = await apiRequest("PATCH", `/api/staff/availability/${id}`, {
        ...data,
        breakStartTime: data.breakStartTime || null,
        breakEndTime: data.breakEndTime || null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff/availability'] });
      toast({ title: "Availability updated", description: "Staff schedule has been updated" });
      handleCloseAvailabilityDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createTimeOffMutation = useMutation({
    mutationFn: async (data: TimeOffFormData) => {
      const response = await apiRequest("POST", "/api/staff/time-off", {
        ...data,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff/time-off'] });
      toast({ title: "Time off request created", description: "Request has been submitted" });
      handleCloseTimeOffDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateTimeOffMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/staff/time-off/${id}`, { status });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff/time-off'] });
      toast({ 
        title: variables.status === 'approved' ? "Request approved" : "Request rejected",
        description: `The time off request has been ${variables.status}`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenAvailabilityDialog = (staffId?: string, dayOfWeek?: number) => {
    setEditingAvailability(null);
    
    if (staffId && dayOfWeek !== undefined) {
      const staff = staffWithAvailability.find(s => s.id === staffId);
      const existing = staff?.availability.get(dayOfWeek);
      
      if (existing) {
        setEditingAvailability(existing);
        availabilityForm.reset({
          userId: existing.userId,
          dayOfWeek: existing.dayOfWeek,
          startTime: existing.startTime,
          endTime: existing.endTime,
          isAvailable: existing.isAvailable ?? true,
          breakStartTime: existing.breakStartTime || null,
          breakEndTime: existing.breakEndTime || null,
          notes: existing.notes || null,
        });
      } else {
        availabilityForm.reset({
          userId: staffId,
          dayOfWeek,
          startTime: "08:00",
          endTime: "17:00",
          isAvailable: true,
          breakStartTime: null,
          breakEndTime: null,
          notes: null,
        });
      }
    } else {
      availabilityForm.reset({
        userId: "",
        dayOfWeek: 1,
        startTime: "08:00",
        endTime: "17:00",
        isAvailable: true,
        breakStartTime: null,
        breakEndTime: null,
        notes: null,
      });
    }
    
    setAvailabilityDialogOpen(true);
  };

  const handleCloseAvailabilityDialog = () => {
    setAvailabilityDialogOpen(false);
    setEditingAvailability(null);
    availabilityForm.reset();
  };

  const handleCloseTimeOffDialog = () => {
    setTimeOffDialogOpen(false);
    timeOffForm.reset();
  };

  const handleSubmitAvailability = (data: AvailabilityFormData) => {
    if (editingAvailability) {
      updateAvailabilityMutation.mutate({ id: editingAvailability.id, data });
    } else {
      createAvailabilityMutation.mutate(data);
    }
  };

  const handleSubmitTimeOff = (data: TimeOffFormData) => {
    createTimeOffMutation.mutate(data);
  };

  const handleApproveTimeOff = (id: string) => {
    updateTimeOffMutation.mutate({ id, status: 'approved' });
  };

  const handleRejectTimeOff = (id: string) => {
    updateTimeOffMutation.mutate({ id, status: 'rejected' });
  };

  const getStaffName = (userId: string) => {
    const member = activeMembers.find(m => m.memberId === userId);
    if (member) {
      return `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email;
    }
    return "Unknown";
  };

  const isLoading = membersLoading || availabilityLoading || timeOffLoading;

  if (isLoading) {
    return (
      <PageShell>
        <div className="p-4 md:p-6 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Staff Rostering</h1>
            <p className="text-muted-foreground">Manage staff schedules and time-off requests</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setTimeOffDialogOpen(true)}
              data-testid="button-new-time-off"
            >
              <CalendarOff className="h-4 w-4 mr-2" />
              Request Time Off
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPIBox
            title="Total Staff"
            value={kpiStats.totalStaff}
            icon={Users}
          />
          <KPIBox
            title="Available Today"
            value={kpiStats.availableToday}
            icon={UserCheck}
          />
          <KPIBox
            title="Pending Requests"
            value={kpiStats.pendingRequests}
            icon={Clock}
          />
          <KPIBox
            title="On Leave"
            value={kpiStats.onLeaveToday}
            icon={CalendarOff}
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList data-testid="tabs-roster">
            <TabsTrigger value="schedule" data-testid="tab-schedule">
              <Calendar className="h-4 w-4 mr-2" />
              Weekly Schedule
            </TabsTrigger>
            <TabsTrigger value="time-off" data-testid="tab-time-off">
              <CalendarOff className="h-4 w-4 mr-2" />
              Time Off Requests
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
                <div>
                  <CardTitle>Weekly Schedule</CardTitle>
                  <CardDescription>View and edit staff availability by day of week</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {staffWithAvailability.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Staff Members</h3>
                    <p className="text-muted-foreground mb-4">
                      Add team members first to manage their schedules
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[150px]">Staff Member</TableHead>
                          {WEEK_DISPLAY_ORDER.map(dayNum => (
                            <TableHead 
                              key={dayNum} 
                              className={cn(
                                "min-w-[100px] text-center",
                                dayNum === todayDayOfWeek && "bg-primary/5"
                              )}
                            >
                              {DAYS_OF_WEEK[dayNum].short}
                              {dayNum === todayDayOfWeek && (
                                <Badge variant="secondary" className="ml-1 text-[10px]">Today</Badge>
                              )}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staffWithAvailability.map(staff => (
                          <TableRow key={staff.id} data-testid={`row-staff-${staff.id}`}>
                            <TableCell className="font-medium">{staff.name}</TableCell>
                            {WEEK_DISPLAY_ORDER.map(dayNum => {
                              const avail = staff.availability.get(dayNum);
                              const isAvailable = avail?.isAvailable ?? false;
                              const hasBreak = avail?.breakStartTime && avail?.breakEndTime;

                              return (
                                <TableCell 
                                  key={dayNum}
                                  className={cn(
                                    "text-center cursor-pointer hover-elevate",
                                    dayNum === todayDayOfWeek && "bg-primary/5",
                                    !isAvailable && avail && "bg-muted/50"
                                  )}
                                  onClick={() => handleOpenAvailabilityDialog(staff.id, dayNum)}
                                  data-testid={`cell-availability-${staff.id}-${dayNum}`}
                                >
                                  {avail ? (
                                    isAvailable ? (
                                      <div className="space-y-0.5">
                                        <div className="text-xs font-medium">
                                          {avail.startTime} - {avail.endTime}
                                        </div>
                                        {hasBreak && (
                                          <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                                            <Coffee className="h-3 w-3" />
                                            {avail.breakStartTime}-{avail.breakEndTime}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <Badge variant="secondary" className="text-[10px]">
                                        <X className="h-3 w-3 mr-1" />
                                        Off
                                      </Badge>
                                    )
                                  ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="time-off" className="mt-4">
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between space-y-0 pb-4">
                <div>
                  <CardTitle>Time Off Requests</CardTitle>
                  <CardDescription>Manage leave and time-off requests</CardDescription>
                </div>
                <Select value={timeOffFilter} onValueChange={setTimeOffFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-time-off-filter">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Requests</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                {filteredTimeOff.length === 0 ? (
                  <div className="text-center py-12">
                    <CalendarOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Time Off Requests</h3>
                    <p className="text-muted-foreground mb-4">
                      {timeOffFilter === "all" 
                        ? "No time off requests have been submitted yet" 
                        : `No ${timeOffFilter} requests found`}
                    </p>
                    <Button onClick={() => setTimeOffDialogOpen(true)} data-testid="button-create-time-off-empty">
                      <Plus className="h-4 w-4 mr-2" />
                      Request Time Off
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Staff Member</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Start Date</TableHead>
                          <TableHead>End Date</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTimeOff.map(request => (
                          <TableRow key={request.id} data-testid={`row-time-off-${request.id}`}>
                            <TableCell className="font-medium">
                              {getStaffName(request.userId)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{getTypeLabel(request.type)}</Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(request.startDate), "dd MMM yyyy")}
                            </TableCell>
                            <TableCell>
                              {format(new Date(request.endDate), "dd MMM yyyy")}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {request.reason || "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadgeVariant(request.status)}>
                                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {request.status === 'pending' && (
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleApproveTimeOff(request.id)}
                                    disabled={updateTimeOffMutation.isPending}
                                    data-testid={`button-approve-${request.id}`}
                                    title="Approve"
                                  >
                                    <Check className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRejectTimeOff(request.id)}
                                    disabled={updateTimeOffMutation.isPending}
                                    data-testid={`button-reject-${request.id}`}
                                    title="Reject"
                                  >
                                    <X className="h-4 w-4 text-red-600" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={availabilityDialogOpen} onOpenChange={setAvailabilityDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingAvailability ? "Edit Availability" : "Set Availability"}
              </DialogTitle>
              <DialogDescription>
                Configure the regular work schedule for this day
              </DialogDescription>
            </DialogHeader>
            <Form {...availabilityForm}>
              <form onSubmit={availabilityForm.handleSubmit(handleSubmitAvailability)} className="space-y-4">
                <FormField
                  control={availabilityForm.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Staff Member</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!!editingAvailability}>
                        <FormControl>
                          <SelectTrigger data-testid="select-availability-staff">
                            <SelectValue placeholder="Select staff member" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {activeMembers.map(member => (
                            <SelectItem key={member.memberId || member.id} value={member.memberId || member.id}>
                              {`${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={availabilityForm.control}
                  name="dayOfWeek"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Day of Week</FormLabel>
                      <Select 
                        onValueChange={(v) => field.onChange(parseInt(v))} 
                        value={field.value?.toString()}
                        disabled={!!editingAvailability}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-availability-day">
                            <SelectValue placeholder="Select day" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DAYS_OF_WEEK.map(day => (
                            <SelectItem key={day.value} value={day.value.toString()}>
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={availabilityForm.control}
                  name="isAvailable"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Available</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Is this staff member working on this day?
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-availability"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {availabilityForm.watch("isAvailable") && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={availabilityForm.control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Time</FormLabel>
                            <FormControl>
                              <Input 
                                type="time" 
                                {...field} 
                                data-testid="input-start-time"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={availabilityForm.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Time</FormLabel>
                            <FormControl>
                              <Input 
                                type="time" 
                                {...field} 
                                data-testid="input-end-time"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Break Time (Optional)</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={availabilityForm.control}
                          name="breakStartTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input 
                                  type="time" 
                                  placeholder="Break Start"
                                  value={field.value || ""}
                                  onChange={e => field.onChange(e.target.value || null)}
                                  data-testid="input-break-start"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={availabilityForm.control}
                          name="breakEndTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input 
                                  type="time" 
                                  placeholder="Break End"
                                  value={field.value || ""}
                                  onChange={e => field.onChange(e.target.value || null)}
                                  data-testid="input-break-end"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </>
                )}

                <FormField
                  control={availabilityForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Any notes about this schedule..."
                          value={field.value || ""}
                          onChange={e => field.onChange(e.target.value || null)}
                          data-testid="input-availability-notes"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleCloseAvailabilityDialog}
                    data-testid="button-cancel-availability"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createAvailabilityMutation.isPending || updateAvailabilityMutation.isPending}
                    data-testid="button-save-availability"
                  >
                    {(createAvailabilityMutation.isPending || updateAvailabilityMutation.isPending) 
                      ? "Saving..." 
                      : "Save"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={timeOffDialogOpen} onOpenChange={setTimeOffDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Request Time Off</DialogTitle>
              <DialogDescription>
                Submit a time off request for review
              </DialogDescription>
            </DialogHeader>
            <Form {...timeOffForm}>
              <form onSubmit={timeOffForm.handleSubmit(handleSubmitTimeOff)} className="space-y-4">
                <FormField
                  control={timeOffForm.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Staff Member</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-time-off-staff">
                            <SelectValue placeholder="Select staff member" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {activeMembers.map(member => (
                            <SelectItem key={member.memberId || member.id} value={member.memberId || member.id}>
                              {`${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={timeOffForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Leave Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-time-off-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TIME_OFF_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={timeOffForm.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field} 
                            data-testid="input-time-off-start"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={timeOffForm.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field} 
                            data-testid="input-time-off-end"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={timeOffForm.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Reason for time off..."
                          value={field.value || ""}
                          onChange={e => field.onChange(e.target.value || null)}
                          data-testid="input-time-off-reason"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleCloseTimeOffDialog}
                    data-testid="button-cancel-time-off"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createTimeOffMutation.isPending}
                    data-testid="button-submit-time-off"
                  >
                    {createTimeOffMutation.isPending ? "Submitting..." : "Submit Request"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </PageShell>
  );
}
