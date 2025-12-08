import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Phone, Mail, MapPin, Clock, CheckCircle, Building2, Calendar as CalendarIcon, ArrowLeft, ArrowRight } from "lucide-react";
import { format, addDays, isBefore, startOfToday } from "date-fns";
import type { BookingService } from "@shared/schema";

interface BookingPortalData {
  settings: {
    welcomeMessage: string;
    businessDescription: string;
    coverImageUrl: string | null;
    requirePhone: boolean;
    requireAddress: boolean;
    minLeadTimeHours: number;
    maxAdvanceBookingDays: number;
    availableDays: string[];
    workingHoursStart: string;
    workingHoursEnd: string;
    slotDurationMinutes: number;
  };
  business: {
    name: string;
    phone: string | null;
    email: string | null;
    logoUrl: string | null;
    brandColor: string | null;
  };
  services: BookingService[];
}

const bookingFormSchema = z.object({
  serviceId: z.string().optional(),
  clientName: z.string().min(1, "Name is required"),
  clientEmail: z.string().email("Valid email is required"),
  clientPhone: z.string().optional(),
  clientAddress: z.string().optional(),
  preferredDate: z.date().optional(),
  preferredTimeSlot: z.string().optional(),
  notes: z.string().optional(),
});

export default function PublicBookingPage() {
  const [, params] = useRoute("/book/:slug");
  const slug = params?.slug;
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  const { data: portalData, isLoading, error } = useQuery<BookingPortalData>({
    queryKey: ["/api/public/booking", slug],
    queryFn: async () => {
      const response = await fetch(`/api/public/booking/${slug}`);
      if (!response.ok) {
        throw new Error("Booking portal not found");
      }
      return response.json();
    },
    enabled: !!slug,
  });

  const form = useForm<z.infer<typeof bookingFormSchema>>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      serviceId: "",
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      clientAddress: "",
      notes: "",
    },
  });

  const selectedDate = form.watch("preferredDate");

  const { data: slotsData } = useQuery<{ slots: string[] }>({
    queryKey: ["/api/public/booking", slug, "slots", selectedDate?.toISOString()],
    queryFn: async () => {
      if (!selectedDate) return { slots: [] };
      const response = await fetch(`/api/public/booking/${slug}/slots?date=${selectedDate.toISOString()}`);
      return response.json();
    },
    enabled: !!selectedDate && !!slug,
  });

  const submitMutation = useMutation({
    mutationFn: async (data: z.infer<typeof bookingFormSchema>) => {
      const response = await fetch(`/api/public/booking/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          preferredDate: data.preferredDate?.toISOString(),
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit booking");
      }
      return response.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: z.infer<typeof bookingFormSchema>) => {
    if (portalData?.settings.requirePhone && !data.clientPhone) {
      form.setError("clientPhone", { message: "Phone number is required" });
      return;
    }
    if (portalData?.settings.requireAddress && !data.clientAddress) {
      form.setError("clientAddress", { message: "Address is required" });
      return;
    }
    submitMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !portalData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h1 className="text-xl font-bold mb-2">Booking Portal Not Found</h1>
            <p className="text-muted-foreground">
              This booking page doesn't exist or is currently unavailable.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full" data-testid="card-booking-success">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <h1 className="text-2xl font-bold mb-2">Booking Request Submitted!</h1>
            <p className="text-muted-foreground mb-6">
              Thank you for your booking request. We'll be in touch shortly to confirm your appointment.
            </p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="flex items-center justify-center gap-2">
                <Building2 className="h-4 w-4" />
                {portalData.business.name}
              </p>
              {portalData.business.phone && (
                <p className="flex items-center justify-center gap-2">
                  <Phone className="h-4 w-4" />
                  {portalData.business.phone}
                </p>
              )}
              {portalData.business.email && (
                <p className="flex items-center justify-center gap-2">
                  <Mail className="h-4 w-4" />
                  {portalData.business.email}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const brandColor = portalData.business.brandColor || "#2563eb";
  const minDate = addDays(startOfToday(), Math.ceil((portalData.settings.minLeadTimeHours || 24) / 24));
  const maxDate = addDays(startOfToday(), portalData.settings.maxAdvanceBookingDays || 30);
  const availableDays = (portalData.settings.availableDays as string[]) || ["monday", "tuesday", "wednesday", "thursday", "friday"];

  const isDateDisabled = (date: Date) => {
    if (isBefore(date, minDate)) return true;
    if (isBefore(maxDate, date)) return true;
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    return !availableDays.includes(dayName);
  };

  const selectedService = portalData.services.find((s) => s.id === form.watch("serviceId"));

  return (
    <div className="min-h-screen bg-background">
      <div 
        className="w-full py-8 px-4"
        style={{ backgroundColor: brandColor }}
      >
        <div className="max-w-2xl mx-auto text-center text-white">
          {portalData.business.logoUrl && (
            <img
              src={portalData.business.logoUrl}
              alt={portalData.business.name}
              className="h-16 mx-auto mb-4 rounded"
            />
          )}
          <h1 className="text-2xl font-bold mb-2">{portalData.business.name}</h1>
          <p className="opacity-90">{portalData.settings.welcomeMessage}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {portalData.settings.businessDescription && (
          <p className="text-center text-muted-foreground mb-8">
            {portalData.settings.businessDescription}
          </p>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {step === 1 && (
              <Card data-testid="card-step-1">
                <CardHeader>
                  <CardTitle>Select a Service</CardTitle>
                  <CardDescription>Choose the service you'd like to book</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {portalData.services.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      No services available for booking at this time.
                    </p>
                  ) : (
                    <FormField
                      control={form.control}
                      name="serviceId"
                      render={({ field }) => (
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="space-y-3"
                        >
                          {portalData.services.map((service) => (
                            <label
                              key={service.id}
                              className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                                field.value === service.id
                                  ? "border-primary bg-primary/5"
                                  : "hover:border-primary/50"
                              }`}
                              data-testid={`service-option-${service.id}`}
                            >
                              <RadioGroupItem value={service.id} className="mt-1" />
                              <div className="ml-3 flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{service.name}</span>
                                  <div className="text-sm">
                                    {service.priceType === "quote" ? (
                                      <Badge variant="outline">Quote Required</Badge>
                                    ) : service.price ? (
                                      <span className="font-semibold text-primary">
                                        {service.priceType === "from" && "From "}
                                        ${parseFloat(service.price).toFixed(2)}
                                        {service.priceType === "hourly" && "/hr"}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                                {service.description && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {service.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                                  <Clock className="h-4 w-4" />
                                  <span>{service.durationMinutes} minutes</span>
                                </div>
                              </div>
                            </label>
                          ))}
                          <label
                            className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                              field.value === ""
                                ? "border-primary bg-primary/5"
                                : "hover:border-primary/50"
                            }`}
                            data-testid="service-option-general"
                          >
                            <RadioGroupItem value="" className="mt-1" />
                            <div className="ml-3">
                              <span className="font-medium">General Inquiry</span>
                              <p className="text-sm text-muted-foreground">
                                Not sure what you need? Let us know and we'll help.
                              </p>
                            </div>
                          </label>
                        </RadioGroup>
                      )}
                    />
                  )}

                  <div className="flex justify-end pt-4">
                    <Button type="button" onClick={() => setStep(2)} data-testid="button-next-step-1">
                      Continue
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <Card data-testid="card-step-2">
                <CardHeader>
                  <CardTitle>Choose a Date & Time</CardTitle>
                  <CardDescription>
                    Select your preferred appointment date
                    {selectedService && (
                      <Badge variant="secondary" className="ml-2">
                        {selectedService.name}
                      </Badge>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="preferredDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred Date</FormLabel>
                        <div className="flex justify-center">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={isDateDisabled}
                            className="rounded-md border"
                            data-testid="calendar-date-picker"
                          />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedDate && slotsData?.slots && slotsData.slots.length > 0 && (
                    <FormField
                      control={form.control}
                      name="preferredTimeSlot"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preferred Time</FormLabel>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {slotsData.slots.map((slot) => (
                              <Button
                                key={slot}
                                type="button"
                                variant={field.value === slot ? "default" : "outline"}
                                size="sm"
                                onClick={() => field.onChange(slot)}
                                className="text-sm"
                                data-testid={`time-slot-${slot}`}
                              >
                                {slot.split("-")[0]}
                              </Button>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="flex justify-between pt-4">
                    <Button type="button" variant="outline" onClick={() => setStep(1)} data-testid="button-back-step-2">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <Button type="button" onClick={() => setStep(3)} data-testid="button-next-step-2">
                      Continue
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 3 && (
              <Card data-testid="card-step-3">
                <CardHeader>
                  <CardTitle>Your Details</CardTitle>
                  <CardDescription>Tell us how to reach you</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="clientName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="John Smith" data-testid="input-client-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="clientEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="john@example.com" data-testid="input-client-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="clientPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Phone {portalData.settings.requirePhone && "*"}
                        </FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" placeholder="0400 000 000" data-testid="input-client-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="clientAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Address {portalData.settings.requireAddress && "*"}
                        </FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="123 Main St, Brisbane QLD 4000" data-testid="input-client-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Tell us more about what you need..." 
                            data-testid="input-client-notes"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-between pt-4">
                    <Button type="button" variant="outline" onClick={() => setStep(2)} data-testid="button-back-step-3">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={submitMutation.isPending}
                      data-testid="button-submit-booking"
                    >
                      {submitMutation.isPending ? "Submitting..." : "Submit Booking Request"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </form>
        </Form>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {portalData.business.phone && (
              <a href={`tel:${portalData.business.phone}`} className="flex items-center gap-1 hover:text-foreground">
                <Phone className="h-4 w-4" />
                {portalData.business.phone}
              </a>
            )}
            {portalData.business.email && (
              <a href={`mailto:${portalData.business.email}`} className="flex items-center gap-1 hover:text-foreground">
                <Mail className="h-4 w-4" />
                {portalData.business.email}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
