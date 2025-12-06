import { useState } from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Plus, Trash2, Edit2, Package, DollarSign, Hash, BookOpen } from "lucide-react";
import CatalogModal from "@/components/CatalogModal";
import { useToast } from "@/hooks/use-toast";

interface LineItemsStepProps {
  tradeType?: string;
}

export default function LineItemsStep({ tradeType }: LineItemsStepProps) {
  const form = useFormContext();
  const { toast } = useToast();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ description: "", quantity: "1", unitPrice: "" });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "lineItems"
  });

  const watchedLineItems = form.watch("lineItems") || [];

  const calculateTotal = (quantity: string, unitPrice: string) => {
    return (parseFloat(quantity) || 0) * (parseFloat(unitPrice) || 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const handleAddItem = () => {
    setEditForm({ description: "", quantity: "1", unitPrice: "" });
    setEditingIndex(-1);
  };

  const handleEditItem = (index: number) => {
    const item = watchedLineItems[index];
    setEditForm({
      description: item.description || "",
      quantity: String(item.quantity || "1"),
      unitPrice: String(item.unitPrice || "")
    });
    setEditingIndex(index);
  };

  const handleSaveItem = () => {
    if (!editForm.description.trim()) {
      toast({
        title: "Description required",
        description: "Please enter a description for this item",
        variant: "destructive"
      });
      return;
    }

    if (editingIndex === -1) {
      append(editForm);
    } else if (editingIndex !== null) {
      update(editingIndex, editForm);
    }
    setEditingIndex(null);
  };

  const handleCatalogSelect = (item: any) => {
    append({
      description: item.name,
      quantity: String(item.defaultQty || 1),
      unitPrice: String(item.unitPrice || "0")
    });
    setCatalogOpen(false);
    toast({
      title: "Item added",
      description: `${item.name} has been added`
    });
  };

  const handleRemoveItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  const subtotal = watchedLineItems.reduce((sum: number, item: any) => 
    sum + calculateTotal(String(item.quantity), String(item.unitPrice)), 0
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1 min-h-[48px]"
          style={{ borderRadius: '12px' }}
          onClick={handleAddItem}
          data-testid="button-add-item"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Item
        </Button>
        
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1 min-h-[48px]"
          style={{ borderRadius: '12px' }}
          onClick={() => setCatalogOpen(true)}
          data-testid="button-browse-catalog"
        >
          <BookOpen className="h-5 w-5 mr-2" />
          Catalog
        </Button>
      </div>

      <div className="space-y-3">
        {fields.length === 0 ? (
          <Card className="overflow-hidden" style={{ borderRadius: '16px' }}>
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No items yet</p>
              <p className="text-sm text-muted-foreground">Add items to your {tradeType || "document"}</p>
            </CardContent>
          </Card>
        ) : (
          fields.map((field, index) => {
            const item = watchedLineItems[index] || {};
            const lineTotal = calculateTotal(String(item.quantity || 0), String(item.unitPrice || 0));
            
            return (
              <Card
                key={field.id}
                className="overflow-hidden"
                style={{ borderRadius: '14px' }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: 'hsl(var(--muted))' }}
                    >
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-medium truncate">
                            {item.description || "Untitled item"}
                          </h4>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Hash className="h-3.5 w-3.5" />
                              {item.quantity || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-3.5 w-3.5" />
                              {formatCurrency(parseFloat(String(item.unitPrice)) || 0)} ea
                            </span>
                          </div>
                        </div>
                        
                        <Badge 
                          variant="outline" 
                          className="font-semibold whitespace-nowrap"
                        >
                          {formatCurrency(lineTotal)}
                        </Badge>
                      </div>
                      
                      <div className="flex gap-2 mt-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-[36px]"
                          style={{ borderRadius: '8px' }}
                          onClick={() => handleEditItem(index)}
                          data-testid={`button-edit-item-${index}`}
                        >
                          <Edit2 className="h-4 w-4 mr-1.5" />
                          Edit
                        </Button>
                        
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="min-h-[36px] text-destructive hover:text-destructive"
                            style={{ borderRadius: '8px' }}
                            onClick={() => handleRemoveItem(index)}
                            data-testid={`button-remove-item-${index}`}
                          >
                            <Trash2 className="h-4 w-4 mr-1.5" />
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Card 
        className="overflow-hidden"
        style={{ 
          borderRadius: '14px',
          backgroundColor: 'hsl(var(--trade) / 0.05)',
          borderColor: 'hsl(var(--trade) / 0.2)'
        }}
      >
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">Subtotal ({fields.length} items)</span>
            <span className="text-lg font-bold">{formatCurrency(subtotal)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">GST will be calculated on final review</p>
        </CardContent>
      </Card>

      {form.formState.errors.lineItems && (
        <p className="text-sm text-destructive">
          {typeof form.formState.errors.lineItems === 'object' && 'message' in form.formState.errors.lineItems
            ? String(form.formState.errors.lineItems.message)
            : "Please add at least one item"}
        </p>
      )}

      <Sheet open={editingIndex !== null} onOpenChange={(open) => !open && setEditingIndex(null)}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh]">
          <SheetHeader className="mb-4">
            <SheetTitle>{editingIndex === -1 ? "Add Item" : "Edit Item"}</SheetTitle>
          </SheetHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Description</Label>
              <Input
                placeholder="What's this item for?"
                className="min-h-[48px]"
                style={{ borderRadius: '10px' }}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                data-testid="input-item-description"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Quantity</Label>
                <Input
                  type="number"
                  placeholder="1"
                  className="min-h-[48px]"
                  style={{ borderRadius: '10px' }}
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                  data-testid="input-item-quantity"
                />
              </div>
              
              <div>
                <Label className="text-sm font-medium mb-2 block">Unit Price ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="min-h-[48px]"
                  style={{ borderRadius: '10px' }}
                  value={editForm.unitPrice}
                  onChange={(e) => setEditForm({ ...editForm, unitPrice: e.target.value })}
                  data-testid="input-item-price"
                />
              </div>
            </div>

            {editForm.description && (
              <Card 
                className="overflow-hidden"
                style={{ borderRadius: '10px', backgroundColor: 'hsl(var(--muted) / 0.5)' }}
              >
                <CardContent className="p-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Line total:</span>
                    <span className="font-bold">
                      {formatCurrency(calculateTotal(editForm.quantity, editForm.unitPrice))}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          
          <SheetFooter className="mt-6 flex-row gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1 min-h-[48px]"
              style={{ borderRadius: '12px' }}
              onClick={() => setEditingIndex(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="lg"
              className="flex-1 text-white font-semibold min-h-[48px]"
              style={{ 
                backgroundColor: 'hsl(var(--trade))',
                borderRadius: '12px'
              }}
              onClick={handleSaveItem}
              data-testid="button-save-item"
            >
              {editingIndex === -1 ? "Add Item" : "Save Changes"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <CatalogModal
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        onSelectItem={handleCatalogSelect}
        tradeType={tradeType}
        data-testid="catalog-modal"
      />
    </div>
  );
}
