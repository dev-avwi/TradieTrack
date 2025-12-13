import { useFormContext } from "react-hook-form";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Calendar, Sparkles, Briefcase } from "lucide-react";
import { useJobs } from "@/hooks/use-jobs";
import TemplateSelector from "@/components/TemplateSelector";
import { type DocumentTemplate } from "@/hooks/use-templates";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface DetailsStepProps {
  type: "quote" | "invoice";
  userTradeType?: string;
  onApplyTemplate?: (template: DocumentTemplate) => void;
  showJobSelector?: boolean;
  showValidUntil?: boolean;
  showDueDate?: boolean;
}

export default function DetailsStep({ 
  type,
  userTradeType,
  onApplyTemplate,
  showJobSelector = true,
  showValidUntil = false,
  showDueDate = false
}: DetailsStepProps) {
  const form = useFormContext();
  const { data: jobs = [] } = useJobs();
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false);

  const handleApplyTemplate = (template: DocumentTemplate) => {
    if (onApplyTemplate) {
      onApplyTemplate(template);
    }
    setTemplateSheetOpen(false);
  };

  return (
    <div className="space-y-4">
      <Sheet open={templateSheetOpen} onOpenChange={setTemplateSheetOpen}>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full min-h-[56px] justify-start gap-3"
            style={{ borderRadius: '12px' }}
            data-testid="button-use-template"
          >
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
            >
              <Sparkles className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
            </div>
            <div className="text-left">
              <div className="font-medium">Use a Template</div>
              <div className="text-sm text-muted-foreground">Quickly fill in common {type}s</div>
            </div>
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[80vh] pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle>Choose a Template</SheetTitle>
          </SheetHeader>
          <div className="overflow-auto h-[calc(80vh-80px)]">
            <TemplateSelector
              type={type}
              onApplyTemplate={handleApplyTemplate}
              userTradeType={userTradeType}
              data-testid={`template-selector-${type}`}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Card className="overflow-hidden" style={{ borderRadius: '16px' }}>
        <CardContent className="p-4 space-y-4">
          <div>
            <Label htmlFor="title" className="text-sm font-medium mb-2 block">
              <FileText className="h-4 w-4 inline mr-2" />
              {type === "quote" ? "Quote" : "Invoice"} Title
            </Label>
            <Input
              id="title"
              placeholder={`Enter ${type} title`}
              className="min-h-[48px]"
              style={{ borderRadius: '10px' }}
              {...form.register("title")}
              data-testid="input-title"
            />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive mt-1">
                {String(form.formState.errors.title.message)}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="description" className="text-sm font-medium mb-2 block">
              Description (Optional)
            </Label>
            <Textarea
              id="description"
              placeholder="Add a description..."
              className="min-h-[100px]"
              style={{ borderRadius: '10px' }}
              {...form.register("description")}
              data-testid="input-description"
            />
          </div>

          {showJobSelector && (
            <div>
              <Label className="text-sm font-medium mb-2 flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Link to Job (Optional)
              </Label>
              <Select 
                onValueChange={(value) => form.setValue("jobId", value === "none" ? "" : value)}
                defaultValue={form.watch("jobId") || "none"}
              >
                <SelectTrigger 
                  className="min-h-[48px]" 
                  style={{ borderRadius: '10px' }}
                  data-testid="select-job"
                >
                  <SelectValue placeholder="Select a job" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No job selected</SelectItem>
                  {(jobs as any[]).map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showValidUntil && (
            <div>
              <Label htmlFor="validUntil" className="text-sm font-medium mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Valid Until
              </Label>
              <Input
                id="validUntil"
                type="date"
                className="min-h-[48px]"
                style={{ borderRadius: '10px' }}
                {...form.register("validUntil")}
                data-testid="input-valid-until"
              />
              {form.formState.errors.validUntil && (
                <p className="text-sm text-destructive mt-1">
                  {String(form.formState.errors.validUntil.message)}
                </p>
              )}
            </div>
          )}

          {showDueDate && (
            <div>
              <Label htmlFor="dueDate" className="text-sm font-medium mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Due Date (Optional)
              </Label>
              <Input
                id="dueDate"
                type="date"
                className="min-h-[48px]"
                style={{ borderRadius: '10px' }}
                {...form.register("dueDate")}
                data-testid="input-due-date"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
