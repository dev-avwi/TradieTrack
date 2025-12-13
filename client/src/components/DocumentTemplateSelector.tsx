import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, FileText, Sparkles, MinusSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { DOCUMENT_TEMPLATES, TemplateId, getTemplateStyles } from "@/lib/document-templates";

interface DocumentTemplateSelectorProps {
  selectedTemplate: TemplateId;
  onSelectTemplate: (templateId: TemplateId) => void;
  brandColor?: string;
}

function MiniDocumentPreview({ 
  templateId, 
  brandColor = '#2563eb',
  isSelected = false 
}: { 
  templateId: TemplateId; 
  brandColor?: string;
  isSelected?: boolean;
}) {
  const { template, primaryColor, tableHeaderStyle, getNoteStyle } = getTemplateStyles(templateId, brandColor);
  
  return (
    <div 
      className={cn(
        "relative rounded-lg border-2 overflow-hidden transition-all duration-200",
        isSelected 
          ? "border-primary ring-2 ring-primary/20" 
          : "border-border hover:border-primary/50"
      )}
      style={{ fontFamily: template.fontFamily, fontSize: '6px' }}
    >
      {isSelected && (
        <div className="absolute top-2 right-2 z-10">
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <Check className="w-3 h-3 text-primary-foreground" />
          </div>
        </div>
      )}
      
      {/* Mini document preview */}
      <div className="bg-white p-3">
        {/* Header */}
        <div 
          className="flex justify-between items-start mb-2 pb-1"
          style={{ 
            borderBottom: template.showHeaderDivider 
              ? `${template.headerBorderWidth} solid ${primaryColor}` 
              : 'none' 
          }}
        >
          <div className="flex items-center gap-1">
            <div 
              className="w-4 h-4 rounded flex items-center justify-center"
              style={{ backgroundColor: primaryColor + '20' }}
            >
              <div 
                className="w-2 h-2 rounded-sm"
                style={{ backgroundColor: primaryColor }}
              />
            </div>
            <div>
              <div 
                className="font-bold text-[5px]"
                style={{ color: primaryColor, fontFamily: template.headingFont }}
              >
                ACME PLUMBING
              </div>
              <div className="text-[4px] text-gray-500">ABN: 12 345 678 901</div>
            </div>
          </div>
          <div className="text-right">
            <div 
              className="font-bold text-[6px] tracking-wide"
              style={{ color: primaryColor, fontFamily: template.headingFont }}
            >
              TAX INVOICE
            </div>
            <div className="text-[4px] text-gray-500">#INV-001</div>
          </div>
        </div>
        
        {/* Table preview */}
        <div className="mb-2">
          <div 
            className="flex text-[4px] py-0.5 px-1 mb-0.5"
            style={{ 
              backgroundColor: tableHeaderStyle.backgroundColor,
              color: tableHeaderStyle.color,
              borderRadius: template.borderRadius,
            }}
          >
            <span className="flex-1">Description</span>
            <span className="w-6 text-right">Qty</span>
            <span className="w-8 text-right">Amount</span>
          </div>
          {[1, 2, 3].map((i) => (
            <div 
              key={i} 
              className="flex text-[4px] py-0.5 px-1"
              style={{
                backgroundColor: template.tableStyle === 'striped' && i % 2 === 0 ? '#f9fafb' : 'transparent',
                borderBottom: template.tableStyle === 'bordered' ? '0.5px solid #eee' : 'none',
              }}
            >
              <span className="flex-1 text-gray-600">Line item {i}</span>
              <span className="w-6 text-right text-gray-600">{i}</span>
              <span className="w-8 text-right text-gray-600">${(i * 150).toFixed(0)}</span>
            </div>
          ))}
        </div>
        
        {/* Total */}
        <div className="flex justify-end">
          <div 
            className="text-right px-1 py-0.5"
            style={{ borderTop: `1px solid ${primaryColor}` }}
          >
            <div className="flex justify-between gap-3 text-[5px]">
              <span className="font-bold" style={{ color: primaryColor }}>Total</span>
              <span className="font-bold" style={{ color: primaryColor }}>$600.00</span>
            </div>
          </div>
        </div>
        
        {/* Notes preview */}
        <div 
          className="mt-2 p-1 text-[4px] text-gray-500"
          style={getNoteStyle()}
        >
          Additional notes...
        </div>
      </div>
    </div>
  );
}

export default function DocumentTemplateSelector({
  selectedTemplate,
  onSelectTemplate,
  brandColor = '#2563eb',
}: DocumentTemplateSelectorProps) {
  const templates = Object.values(DOCUMENT_TEMPLATES);
  
  const getTemplateIcon = (templateId: TemplateId) => {
    switch (templateId) {
      case 'modern':
        return <Sparkles className="h-4 w-4" />;
      case 'minimal':
        return <MinusSquare className="h-4 w-4" />;
      case 'professional':
      default:
        return <FileText className="h-4 w-4" />;
    }
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Document Templates</h3>
        <p className="text-sm text-muted-foreground">
          Choose a template style for your quotes and invoices. The selected template will be applied 
          across all documents in the app and PDFs.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {templates.map((template) => {
          const isSelected = selectedTemplate === template.id;
          
          return (
            <Card 
              key={template.id}
              className={cn(
                "cursor-pointer transition-all duration-200 hover-elevate",
                isSelected && "ring-2 ring-primary"
              )}
              onClick={() => onSelectTemplate(template.id)}
              data-testid={`template-card-${template.id}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getTemplateIcon(template.id)}
                    <CardTitle className="text-base">{template.name}</CardTitle>
                  </div>
                  {isSelected && (
                    <Badge variant="default" className="text-xs">
                      Active
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs line-clamp-2">
                  {template.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MiniDocumentPreview 
                  templateId={template.id} 
                  brandColor={brandColor}
                  isSelected={isSelected}
                />
                
                <Button 
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className="w-full mt-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTemplate(template.id);
                  }}
                  data-testid={`button-select-template-${template.id}`}
                >
                  {isSelected ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Selected
                    </>
                  ) : (
                    'Select Template'
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {/* Template features comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Template Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4">Feature</th>
                  {templates.map((t) => (
                    <th key={t.id} className="text-center py-2 px-2">
                      {t.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 pr-4 text-muted-foreground">Font Style</td>
                  <td className="text-center py-2 px-2">Serif</td>
                  <td className="text-center py-2 px-2">Sans-serif</td>
                  <td className="text-center py-2 px-2">Modern sans</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4 text-muted-foreground">Table Style</td>
                  <td className="text-center py-2 px-2">Bordered</td>
                  <td className="text-center py-2 px-2">Striped</td>
                  <td className="text-center py-2 px-2">Clean lines</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4 text-muted-foreground">Color Usage</td>
                  <td className="text-center py-2 px-2">Subtle</td>
                  <td className="text-center py-2 px-2">Bold brand</td>
                  <td className="text-center py-2 px-2">Minimal</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-muted-foreground">Best For</td>
                  <td className="text-center py-2 px-2 text-xs">Traditional business</td>
                  <td className="text-center py-2 px-2 text-xs">Modern trades</td>
                  <td className="text-center py-2 px-2 text-xs">Clean aesthetic</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
