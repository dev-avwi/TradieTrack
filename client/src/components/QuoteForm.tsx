import { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { WizardLayout, WIZARD_ICONS } from "@/components/FormWizard";
import ClientStep from "@/components/wizard-steps/ClientStep";
import DetailsStep from "@/components/wizard-steps/DetailsStep";
import LineItemsStep from "@/components/wizard-steps/LineItemsStep";
import ReviewStep from "@/components/wizard-steps/ReviewStep";
import { useCreateQuote } from "@/hooks/use-quotes";
import { useToast } from "@/hooks/use-toast";
import { type DocumentTemplate } from "@/hooks/use-templates";
import { useQuery } from "@tanstack/react-query";

const quoteFormSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  jobId: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  validUntil: z.string().min(1, "Valid until date is required"),
  notes: z.string().optional(),
  lineItems: z.array(z.object({
    description: z.string().min(1, "Description is required"),
    quantity: z.string().min(1, "Quantity is required"),
    unitPrice: z.string().min(1, "Unit price is required"),
  })).min(1, "At least one line item is required"),
});

type QuoteFormData = z.infer<typeof quoteFormSchema>;

interface QuoteFormProps {
  onSubmit?: (quoteId: string) => void;
  onCancel?: () => void;
}

const WIZARD_STEPS = [
  {
    id: "client",
    title: "Select Client",
    description: "Who is this quote for?",
    icon: WIZARD_ICONS.client,
    validationFields: ["clientId"]
  },
  {
    id: "details",
    title: "Quote Details",
    description: "Add title and description",
    icon: WIZARD_ICONS.details,
    validationFields: ["title", "validUntil"]
  },
  {
    id: "items",
    title: "Add Items",
    description: "What are you quoting for?",
    icon: WIZARD_ICONS.items,
    validationFields: ["lineItems"]
  },
  {
    id: "review",
    title: "Review & Create",
    description: "Check everything looks good",
    icon: WIZARD_ICONS.review,
    validationFields: []
  }
];

export default function QuoteForm({ onSubmit, onCancel }: QuoteFormProps) {
  const { toast } = useToast();
  const createQuoteMutation = useCreateQuote();

  const { data: userCheck } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) throw new Error('Not authenticated');
      return res.json();
    },
    retry: false,
    staleTime: 30000,
  });

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      clientId: "",
      jobId: "",
      title: "",
      description: "",
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: "",
      lineItems: [{ description: "", quantity: "1", unitPrice: "" }],
    },
  });

  const calculateTotal = () => {
    const lineItems = form.watch("lineItems") || [];
    const subtotal = lineItems.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      return sum + (quantity * unitPrice);
    }, 0);
    const gst = subtotal * 0.1;
    return { subtotal, gst, total: subtotal + gst };
  };

  const handleApplyTemplate = (template: DocumentTemplate) => {
    try {
      const defaults = template.defaults || {};
      const defaultLineItems = template.defaultLineItems || [];
      
      if (defaults.title) form.setValue("title", defaults.title);
      if (defaults.description) form.setValue("description", defaults.description);
      
      if (defaultLineItems.length > 0) {
        const templateLineItems = defaultLineItems.map((item) => ({
          description: item.description || "",
          quantity: String(item.qty || 1),
          unitPrice: String(item.unitPrice || ""),
        }));
        form.setValue("lineItems", templateLineItems);
      }
    } catch (error) {
      toast({
        title: "Error applying template",
        description: "There was an issue applying the template data",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (data: QuoteFormData) => {
    try {
      const { subtotal, gst, total } = calculateTotal();
      
      const quoteData = {
        ...data,
        subtotal: subtotal.toFixed(2),
        gstAmount: gst.toFixed(2),
        total: total.toFixed(2),
      };

      const result = await createQuoteMutation.mutateAsync(quoteData);
      
      toast({
        title: "Quote created",
        description: "Quote has been created successfully",
      });
      
      if (onSubmit) onSubmit(result.id);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create quote",
        variant: "destructive",
      });
      throw error;
    }
  };

  return (
    <div className="w-full py-4" data-testid="page-quote-form">
      <FormProvider {...form}>
        <WizardLayout
          steps={WIZARD_STEPS}
          form={form}
          onSubmit={handleSubmit}
          onCancel={onCancel}
          submitLabel="Create Quote"
        >
          <ClientStep fieldName="clientId" />
          
          <DetailsStep 
            type="quote"
            userTradeType={userCheck?.user?.tradeType}
            onApplyTemplate={handleApplyTemplate}
            showValidUntil={true}
          />
          
          <LineItemsStep tradeType={userCheck?.user?.tradeType} />
          
          <ReviewStep type="quote" showNotes={true} />
        </WizardLayout>
      </FormProvider>
    </div>
  );
}
