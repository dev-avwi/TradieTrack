import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2 } from "lucide-react";
import { tradeCatalog, getTradeDefinition } from "@shared/tradeCatalog";

const businessProfileSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  abn: z.string().optional(),
  contactEmail: z.string().email("Please enter a valid email address"),
  contactPhone: z.string().min(1, "Phone number is required"),
  address: z.string().optional(), // Made optional - can add later in Settings
  city: z.string().optional(), // Made optional - can add later in Settings
  state: z.string().optional(), // Made optional - no auto-default to avoid wrong state
  postcode: z.string().optional(), // Made optional - can add later in Settings
  gstRegistered: z.boolean().default(false),
  tradeType: z.string().min(1, "Please select your trade type"),
});

type BusinessProfileData = z.infer<typeof businessProfileSchema>;

interface BusinessProfileStepProps {
  data: BusinessProfileData;
  onComplete: (data: BusinessProfileData) => void;
  onPrevious: () => void;
  isFirst: boolean;
}

const AUSTRALIAN_STATES = [
  { value: "NSW", label: "New South Wales" },
  { value: "VIC", label: "Victoria" },
  { value: "QLD", label: "Queensland" },
  { value: "WA", label: "Western Australia" },
  { value: "SA", label: "South Australia" },
  { value: "TAS", label: "Tasmania" },
  { value: "ACT", label: "Australian Capital Territory" },
  { value: "NT", label: "Northern Territory" },
];

export default function BusinessProfileStep({
  data,
  onComplete,
  onPrevious,
  isFirst
}: BusinessProfileStepProps) {
  const form = useForm<BusinessProfileData>({
    resolver: zodResolver(businessProfileSchema),
    defaultValues: {
      companyName: data.companyName || '',
      abn: data.abn || '',
      contactEmail: data.contactEmail || '',
      contactPhone: data.contactPhone || '',
      address: data.address || '',
      city: data.city || '',
      state: data.state || '', // No default - user must select if they fill in address
      postcode: data.postcode || '',
      gstRegistered: data.gstRegistered || false,
      tradeType: data.tradeType || 'plumbing',
    },
  });

  const handleSubmit = async (formData: BusinessProfileData) => {
    // Complete this step with the form data
    // Wizard handles navigation after onComplete
    onComplete(formData);
  };

  const selectedTrade = form.watch("tradeType");
  const tradeInfo = getTradeDefinition(selectedTrade);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          Business Profile Setup
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Company Name */}
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter your business name" 
                      {...field} 
                      data-testid="input-company-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Trade Type */}
            <FormField
              control={form.control}
              name="tradeType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trade Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-trade-type">
                        <SelectValue placeholder="Select your trade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(tradeCatalog).map(([key, trade]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: trade.color }}
                            />
                            {trade.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    This helps us customize your experience and templates
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ABN */}
            <FormField
              control={form.control}
              name="abn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Australian Business Number (ABN)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="12 345 678 901" 
                      {...field} 
                      data-testid="input-abn"
                    />
                  </FormControl>
                  <FormDescription>
                    Optional - helps with invoicing and GST calculations
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* GST Registration */}
            <FormField
              control={form.control}
              name="gstRegistered"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">GST Registered</FormLabel>
                    <FormDescription>
                      Are you registered for GST? This affects invoice calculations.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-gst-registered"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Contact Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Email *</FormLabel>
                    <FormControl>
                      <Input 
                        type="email"
                        placeholder="your@email.com" 
                        {...field} 
                        data-testid="input-contact-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Phone *</FormLabel>
                    <FormControl>
                      <Input 
                        type="tel"
                        placeholder="0400 123 456" 
                        {...field} 
                        data-testid="input-contact-phone"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Business Address - Optional Section */}
            <div className="space-y-4 p-4 rounded-lg border border-dashed">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Optional: Add your business address (you can complete this later in Settings)</p>
                <p className="text-xs text-amber-600">Note: Your address will appear on invoices and quotes if provided</p>
              </div>
              
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Address</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="123 Main Street" 
                        {...field} 
                        data-testid="input-address"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* City, State, Postcode */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Sydney" 
                          {...field} 
                          data-testid="input-city"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-state">
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {AUSTRALIAN_STATES.map((state) => (
                            <SelectItem key={state.value} value={state.value}>
                              {state.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="postcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postcode</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="2000" 
                          {...field} 
                          data-testid="input-postcode"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Trade Preview - What you get */}
            {selectedTrade && tradeInfo && (
              <div className="p-4 rounded-lg border bg-muted space-y-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-full border-2 border-white shadow-sm flex items-center justify-center" 
                    style={{ backgroundColor: tradeInfo.color }}
                  >
                    <span className="text-white text-sm font-bold">
                      {tradeInfo.shortName.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-medium">{tradeInfo.name}</h4>
                    <p className="text-sm text-muted-foreground">{tradeInfo.description}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span>{tradeInfo.customFields.length} custom fields tailored for {tradeInfo.shortName.toLowerCase()}s</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span>{tradeInfo.defaultMaterials.length} pre-loaded materials & pricing</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span>Industry-standard rate card (${tradeInfo.defaultRateCard.hourlyRate}/hr)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span>{tradeInfo.safetyChecklists.length} safety checklist{tradeInfo.safetyChecklists.length !== 1 ? 's' : ''} included</span>
                  </div>
                </div>

                {tradeInfo.terminology.job !== 'Job' && (
                  <p className="text-xs text-muted-foreground border-t pt-3">
                    Your app will use "{tradeInfo.terminology.job}" instead of "Job" and "{tradeInfo.terminology.worksite}" instead of "Site"
                  </p>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onPrevious}
                disabled={isFirst}
                data-testid="button-previous"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              
              <Button
                type="submit"
                data-testid="button-continue"
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}