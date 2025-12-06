import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { ArrowLeft, ArrowRight, DollarSign } from "lucide-react";

const defaultRatesSchema = z.object({
  hourlyRate: z.number().min(0, "Hourly rate must be positive").default(85),
  calloutFee: z.number().min(0, "Callout fee must be positive").default(120),
  paymentTerms: z.number().min(0, "Payment terms must be positive").max(365, "Maximum 365 days").default(14),
  quoteValidityPeriod: z.number().min(0, "Quote validity must be positive").max(365, "Maximum 365 days").default(30),
  gstRate: z.number().min(0).max(100, "GST rate must be between 0-100%").default(10),
});

type DefaultRatesData = z.infer<typeof defaultRatesSchema>;

interface DefaultRatesStepProps {
  data: DefaultRatesData;
  onComplete: (data: DefaultRatesData) => void;
  onPrevious: () => void;
}

export default function DefaultRatesStep({
  data,
  onComplete,
  onPrevious
}: DefaultRatesStepProps) {
  const form = useForm<DefaultRatesData>({
    resolver: zodResolver(defaultRatesSchema),
    defaultValues: {
      hourlyRate: data.hourlyRate || 85,
      calloutFee: data.calloutFee || 120,
      paymentTerms: data.paymentTerms || 14,
      quoteValidityPeriod: data.quoteValidityPeriod || 30,
      gstRate: data.gstRate || 10,
    },
  });

  const handleSubmit = async (formData: DefaultRatesData) => {
    onComplete(formData);
  };

  const handleUseDefaults = () => {
    // Use sensible Australian tradie defaults and continue
    onComplete({
      hourlyRate: 85,
      calloutFee: 120,
      paymentTerms: 14,
      quoteValidityPeriod: 30,
      gstRate: 10,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-6 w-6" />
          Default Rates & Terms
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Quick Start Option */}
        <div className="mb-6 p-4 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-medium">Quick Start</h4>
              <p className="text-sm text-muted-foreground">
                Use standard Australian tradie rates ($85/hr, $120 callout, 10% GST)
              </p>
            </div>
            <Button 
              type="button"
              variant="outline"
              onClick={handleUseDefaults}
              className="whitespace-nowrap"
              data-testid="button-use-defaults"
            >
              Use Defaults & Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6">Or customize your rates below:</p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            
            {/* Hourly Rate */}
            <FormField
              control={form.control}
              name="hourlyRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hourly Rate (AUD) *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="5"
                        placeholder="85"
                        className="pl-7"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        data-testid="input-hourly-rate"
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Your standard hourly rate for labor ($85 is typical for Australian tradies)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Callout Fee */}
            <FormField
              control={form.control}
              name="calloutFee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Callout Fee (AUD) *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="10"
                        placeholder="120"
                        className="pl-7"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        data-testid="input-callout-fee"
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Standard fee for coming out to a job site
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Payment Terms */}
            <FormField
              control={form.control}
              name="paymentTerms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Terms (Days) *</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="365"
                        placeholder="14"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-payment-terms"
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        days
                      </span>
                    </div>
                  </FormControl>
                  <FormDescription>
                    How many days clients have to pay invoices (14 days is standard)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Quote Validity Period */}
            <FormField
              control={form.control}
              name="quoteValidityPeriod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quote Validity Period (Days) *</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="365"
                        placeholder="30"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-quote-validity"
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        days
                      </span>
                    </div>
                  </FormControl>
                  <FormDescription>
                    How long your quotes remain valid before expiring
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* GST Rate */}
            <FormField
              control={form.control}
              name="gstRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GST Rate (%) *</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="10"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        data-testid="input-gst-rate"
                      />
                      <span className="text-sm text-muted-foreground">
                        %
                      </span>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Australian GST rate (10% is standard)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Rate Summary Preview */}
            <div className="p-4 rounded-lg border bg-muted">
              <h4 className="font-medium mb-3">Rate Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hourly Rate:</span>
                  <span className="font-medium">${form.watch("hourlyRate")}/hr</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Callout Fee:</span>
                  <span className="font-medium">${form.watch("calloutFee")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Terms:</span>
                  <span className="font-medium">{form.watch("paymentTerms")} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quote Valid For:</span>
                  <span className="font-medium">{form.watch("quoteValidityPeriod")} days</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-muted-foreground">GST:</span>
                  <span className="font-medium">{form.watch("gstRate")}%</span>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onPrevious}
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
