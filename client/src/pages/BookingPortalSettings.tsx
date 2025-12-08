import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Globe, Link, Settings, Clock, Calendar, Plus, Trash2, Edit2, Copy, ExternalLink, Eye } from "lucide-react";
import type { BookingPortalSettings, BookingService } from "@shared/schema";

const settingsSchema = z.object({
  isEnabled: z.boolean(),
  urlSlug: z.string().min(3, "URL must be at least 3 characters").regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
  welcomeMessage: z.string().optional(),
  businessDescription: z.string().optional(),
  requirePhone: z.boolean(),
  requireAddress: z.boolean(),
  minLeadTimeHours: z.number().min(0).max(168),
  maxAdvanceBookingDays: z.number().min(1).max(365),
  confirmationEmailEnabled: z.boolean(),
  notifyOnBookingEmail: z.string().email().optional().or(z.literal("")),
  workingHoursStart: z.string(),
  workingHoursEnd: z.string(),
  slotDurationMinutes: z.number(),
  availableDays: z.array(z.string()),
});

const serviceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  durationMinutes: z.number().min(15).max(480),
  price: z.string().optional(),
  priceType: z.enum(["fixed", "from", "hourly", "quote"]),
  category: z.string().optional(),
  isActive: z.boolean(),
});

const DAYS_OF_WEEK = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

export default function BookingPortalSettingsPage() {
  const { toast } = useToast();
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<BookingService | null>(null);

  const { data: settings, isLoading: settingsLoading } = useQuery<BookingPortalSettings | null>({
    queryKey: ["/api/booking/settings"],
  });

  const { data: services = [], isLoading: servicesLoading } = useQuery<BookingService[]>({
    queryKey: ["/api/booking/services"],
  });

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      isEnabled: false,
      urlSlug: "",
      welcomeMessage: "Welcome! Book a service with us.",
      businessDescription: "",
      requirePhone: true,
      requireAddress: true,
      minLeadTimeHours: 24,
      maxAdvanceBookingDays: 30,
      confirmationEmailEnabled: true,
      notifyOnBookingEmail: "",
      workingHoursStart: "08:00",
      workingHoursEnd: "17:00",
      slotDurationMinutes: 60,
      availableDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    },
    values: settings ? {
      isEnabled: settings.isEnabled ?? false,
      urlSlug: settings.urlSlug || "",
      welcomeMessage: settings.welcomeMessage || "",
      businessDescription: settings.businessDescription || "",
      requirePhone: settings.requirePhone ?? true,
      requireAddress: settings.requireAddress ?? true,
      minLeadTimeHours: settings.minLeadTimeHours ?? 24,
      maxAdvanceBookingDays: settings.maxAdvanceBookingDays ?? 30,
      confirmationEmailEnabled: settings.confirmationEmailEnabled ?? true,
      notifyOnBookingEmail: settings.notifyOnBookingEmail || "",
      workingHoursStart: settings.workingHoursStart || "08:00",
      workingHoursEnd: settings.workingHoursEnd || "17:00",
      slotDurationMinutes: settings.slotDurationMinutes ?? 60,
      availableDays: (settings.availableDays as string[]) || ["monday", "tuesday", "wednesday", "thursday", "friday"],
    } : undefined,
  });

  const serviceForm = useForm<z.infer<typeof serviceSchema>>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: "",
      description: "",
      durationMinutes: 60,
      price: "",
      priceType: "fixed",
      category: "",
      isActive: true,
    },
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (data: z.infer<typeof settingsSchema>) => {
      return await apiRequest("/api/booking/settings", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/booking/settings"] });
      toast({ title: "Settings saved", description: "Your booking portal settings have been updated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save settings", variant: "destructive" });
    },
  });

  const saveServiceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof serviceSchema>) => {
      if (editingService) {
        return await apiRequest(`/api/booking/services/${editingService.id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
      }
      return await apiRequest("/api/booking/services", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/booking/services"] });
      setIsServiceDialogOpen(false);
      setEditingService(null);
      serviceForm.reset();
      toast({ title: editingService ? "Service updated" : "Service created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/booking/services/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/booking/services"] });
      toast({ title: "Service deleted" });
    },
  });

  const onSubmit = (data: z.infer<typeof settingsSchema>) => {
    saveSettingsMutation.mutate(data);
  };

  const onServiceSubmit = (data: z.infer<typeof serviceSchema>) => {
    saveServiceMutation.mutate(data);
  };

  const handleEditService = (service: BookingService) => {
    setEditingService(service);
    serviceForm.reset({
      name: service.name,
      description: service.description || "",
      durationMinutes: service.durationMinutes ?? 60,
      price: service.price || "",
      priceType: (service.priceType as any) || "fixed",
      category: service.category || "",
      isActive: service.isActive ?? true,
    });
    setIsServiceDialogOpen(true);
  };

  const bookingUrl = settings?.urlSlug 
    ? `${window.location.origin}/book/${settings.urlSlug}`
    : null;

  const copyBookingUrl = () => {
    if (bookingUrl) {
      navigator.clipboard.writeText(bookingUrl);
      toast({ title: "Copied!", description: "Booking URL copied to clipboard" });
    }
  };

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Online Booking Portal</h1>
          <p className="text-muted-foreground">Let clients book services directly from your website</p>
        </div>
        {bookingUrl && settings?.isEnabled && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyBookingUrl} data-testid="button-copy-url">
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
            <Button variant="outline" size="sm" asChild data-testid="button-preview">
              <a href={`/book/${settings.urlSlug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Preview
              </a>
            </Button>
          </div>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card data-testid="card-portal-settings">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Portal Settings
              </CardTitle>
              <CardDescription>Configure your public booking page</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Booking Portal</Label>
                  <p className="text-sm text-muted-foreground">Allow clients to book services online</p>
                </div>
                <FormField
                  control={form.control}
                  name="isEnabled"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-enable-portal"
                    />
                  )}
                />
              </div>

              <Separator />

              <FormField
                control={form.control}
                name="urlSlug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Booking URL</FormLabel>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{window.location.origin}/book/</span>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="your-business-name" 
                          className="max-w-xs"
                          data-testid="input-url-slug"
                        />
                      </FormControl>
                    </div>
                    <FormDescription>Choose a unique URL for your booking page</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="welcomeMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Welcome Message</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Welcome! Book a service with us."
                        data-testid="input-welcome-message"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="businessDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Tell clients about your services..."
                        data-testid="input-business-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card data-testid="card-availability">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Availability
              </CardTitle>
              <CardDescription>Set your working hours and available days</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="workingHoursStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} data-testid="input-start-time" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="workingHoursEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} data-testid="input-end-time" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="availableDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Available Days</FormLabel>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <label key={day.value} className="flex items-center gap-2">
                          <Checkbox
                            checked={field.value.includes(day.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange([...field.value, day.value]);
                              } else {
                                field.onChange(field.value.filter((d) => d !== day.value));
                              }
                            }}
                          />
                          <span className="text-sm">{day.label}</span>
                        </label>
                      ))}
                    </div>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="slotDurationMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time Slot Duration</FormLabel>
                      <Select
                        value={String(field.value)}
                        onValueChange={(val) => field.onChange(parseInt(val))}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-slot-duration">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="60">1 hour</SelectItem>
                          <SelectItem value="90">1.5 hours</SelectItem>
                          <SelectItem value="120">2 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="minLeadTimeHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Notice</FormLabel>
                      <Select
                        value={String(field.value)}
                        onValueChange={(val) => field.onChange(parseInt(val))}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-min-notice">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">No minimum</SelectItem>
                          <SelectItem value="1">1 hour</SelectItem>
                          <SelectItem value="2">2 hours</SelectItem>
                          <SelectItem value="4">4 hours</SelectItem>
                          <SelectItem value="24">24 hours</SelectItem>
                          <SelectItem value="48">48 hours</SelectItem>
                          <SelectItem value="72">72 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="maxAdvanceBookingDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Advance Booking</FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(val) => field.onChange(parseInt(val))}
                    >
                      <FormControl>
                        <SelectTrigger className="w-48" data-testid="select-max-advance">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="7">1 week</SelectItem>
                        <SelectItem value="14">2 weeks</SelectItem>
                        <SelectItem value="30">1 month</SelectItem>
                        <SelectItem value="60">2 months</SelectItem>
                        <SelectItem value="90">3 months</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>How far in advance can clients book</FormDescription>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card data-testid="card-booking-requirements">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Booking Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Phone Number</Label>
                  <p className="text-sm text-muted-foreground">Clients must provide a phone number</p>
                </div>
                <FormField
                  control={form.control}
                  name="requirePhone"
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Address</Label>
                  <p className="text-sm text-muted-foreground">Clients must provide their address</p>
                </div>
                <FormField
                  control={form.control}
                  name="requireAddress"
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Confirmation Emails</Label>
                  <p className="text-sm text-muted-foreground">Send confirmation email to client</p>
                </div>
                <FormField
                  control={form.control}
                  name="confirmationEmailEnabled"
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notifyOnBookingEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notify Me At</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        {...field} 
                        placeholder="your@email.com"
                        data-testid="input-notify-email"
                      />
                    </FormControl>
                    <FormDescription>Receive email notifications for new bookings</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={saveSettingsMutation.isPending} data-testid="button-save-settings">
              {saveSettingsMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </Form>

      <Card data-testid="card-services">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Bookable Services
              </CardTitle>
              <CardDescription>Services clients can book online</CardDescription>
            </div>
            <Dialog open={isServiceDialogOpen} onOpenChange={(open) => {
              setIsServiceDialogOpen(open);
              if (!open) {
                setEditingService(null);
                serviceForm.reset();
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-service">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingService ? "Edit Service" : "Add Service"}</DialogTitle>
                  <DialogDescription>
                    Configure a service that clients can book
                  </DialogDescription>
                </DialogHeader>
                <Form {...serviceForm}>
                  <form onSubmit={serviceForm.handleSubmit(onServiceSubmit)} className="space-y-4">
                    <FormField
                      control={serviceForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Service Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., Hot Water System Repair" data-testid="input-service-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={serviceForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Describe the service..." data-testid="input-service-description" />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={serviceForm.control}
                        name="durationMinutes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Duration</FormLabel>
                            <Select
                              value={String(field.value)}
                              onValueChange={(val) => field.onChange(parseInt(val))}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-service-duration">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="30">30 min</SelectItem>
                                <SelectItem value="60">1 hour</SelectItem>
                                <SelectItem value="90">1.5 hours</SelectItem>
                                <SelectItem value="120">2 hours</SelectItem>
                                <SelectItem value="180">3 hours</SelectItem>
                                <SelectItem value="240">4 hours</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={serviceForm.control}
                        name="priceType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Price Type</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger data-testid="select-price-type">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="fixed">Fixed Price</SelectItem>
                                <SelectItem value="from">Starting From</SelectItem>
                                <SelectItem value="hourly">Hourly Rate</SelectItem>
                                <SelectItem value="quote">Quote Required</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>

                    {serviceForm.watch("priceType") !== "quote" && (
                      <FormField
                        control={serviceForm.control}
                        name="price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Price ($)</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="0.01" placeholder="0.00" data-testid="input-service-price" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={serviceForm.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category (optional)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., Plumbing, Electrical" data-testid="input-service-category" />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="flex items-center gap-2">
                      <FormField
                        control={serviceForm.control}
                        name="isActive"
                        render={({ field }) => (
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        )}
                      />
                      <Label>Active (visible to clients)</Label>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsServiceDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={saveServiceMutation.isPending} data-testid="button-save-service">
                        {saveServiceMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {servicesLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading services...</div>
          ) : services.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No services added yet</p>
              <p className="text-sm">Add services that clients can book online</p>
            </div>
          ) : (
            <div className="space-y-3">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                  data-testid={`service-item-${service.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{service.name}</span>
                      {!service.isActive && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                      {service.category && (
                        <Badge variant="outline">{service.category}</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-3 mt-1">
                      <span>{service.durationMinutes} min</span>
                      {service.priceType === "quote" ? (
                        <span>Quote required</span>
                      ) : service.price ? (
                        <span>
                          {service.priceType === "from" && "From "}
                          ${parseFloat(service.price).toFixed(2)}
                          {service.priceType === "hourly" && "/hr"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditService(service)}
                      data-testid={`button-edit-service-${service.id}`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteServiceMutation.mutate(service.id)}
                      data-testid={`button-delete-service-${service.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
