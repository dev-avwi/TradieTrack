import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { FormStoreTemplate } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/compact-card";
import { SearchBar, FilterChips } from "@/components/ui/filter-chips";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Download,
  Star,
  FileText,
  Zap,
  Droplet,
  Wind,
  Hammer,
  Home,
  Trees,
  Paintbrush,
  Sparkles,
  ShieldCheck,
  ClipboardCheck,
  Search,
  CheckSquare,
  Wrench,
  Package,
  FileSpreadsheet,
  Check,
  ChevronRight,
  Store,
  TrendingUp,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import KPIBox from "@/components/KPIBox";

const categoryIcons: Record<string, any> = {
  electrical: Zap,
  plumbing: Droplet,
  hvac: Wind,
  carpentry: Hammer,
  roofing: Home,
  landscaping: Trees,
  painting: Paintbrush,
  cleaning: Sparkles,
  general: FileText,
};

const tradeTypeIcons: Record<string, any> = {
  safety: ShieldCheck,
  compliance: ClipboardCheck,
  inspection: Search,
  checklist: CheckSquare,
  quote: FileText,
  report: FileSpreadsheet,
  maintenance: Wrench,
  installation: Package,
};

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface TradeType {
  id: string;
  name: string;
  icon: string;
}

export default function FormStore() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [tradeTypeFilter, setTradeTypeFilter] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<FormStoreTemplate | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: templates = [], isLoading: templatesLoading } = useQuery<FormStoreTemplate[]>({
    queryKey: ['/api/form-store/templates', categoryFilter, tradeTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.append('category', categoryFilter);
      if (tradeTypeFilter !== "all") params.append('tradeType', tradeTypeFilter);
      const response = await fetch(`/api/form-store/templates?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    },
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/form-store/categories'],
  });

  const { data: tradeTypes = [] } = useQuery<TradeType[]>({
    queryKey: ['/api/form-store/trade-types'],
  });

  const { data: installations = [] } = useQuery<{ storeTemplateId: string }[]>({
    queryKey: ['/api/form-store/installations'],
  });

  const installMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await apiRequest("POST", `/api/form-store/templates/${templateId}/install`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/form-store/installations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/job-forms/templates'] });
      toast({
        title: "Form Installed",
        description: "The form has been added to your templates.",
      });
      setPreviewOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Installation Failed",
        description: error.message || "Could not install the form.",
        variant: "destructive",
      });
    },
  });

  const installedIds = new Set(installations.map(i => i.storeTemplateId));

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (template.description?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (template.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())));
    return matchesSearch;
  });

  const stats = {
    total: templates.length,
    installed: installations.length,
    categories: new Set(templates.map(t => t.category)).size,
  };

  const categoryChips = [
    { id: 'all', label: 'All Categories', count: templates.length, icon: <Store className="h-3 w-3" /> },
    ...categories.map(cat => ({
      id: cat.id,
      label: cat.name,
      count: templates.filter(t => t.category === cat.id).length,
      icon: (() => {
        const Icon = categoryIcons[cat.id] || FileText;
        return <Icon className="h-3 w-3" />;
      })(),
    })),
  ];

  const tradeTypeChips = [
    { id: 'all', label: 'All Types', icon: <FileText className="h-3 w-3" /> },
    ...tradeTypes.map(tt => ({
      id: tt.id,
      label: tt.name,
      icon: (() => {
        const Icon = tradeTypeIcons[tt.id] || FileText;
        return <Icon className="h-3 w-3" />;
      })(),
    })),
  ];

  const handlePreview = (template: FormStoreTemplate) => {
    setSelectedTemplate(template);
    setPreviewOpen(true);
  };

  const handleInstall = (templateId: string) => {
    installMutation.mutate(templateId);
  };

  const getCategoryIcon = (category: string) => {
    const Icon = categoryIcons[category] || FileText;
    return <Icon className="h-4 w-4" />;
  };

  const getTradeTypeIcon = (tradeType: string) => {
    const Icon = tradeTypeIcons[tradeType] || FileText;
    return <Icon className="h-4 w-4" />;
  };

  if (templatesLoading) {
    return (
      <PageShell data-testid="form-store-page">
        <PageHeader 
          title="Form Store"
          subtitle="Loading forms..."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell data-testid="form-store-page">
      <PageHeader
        title="Form Store"
        subtitle="Browse and install pre-made forms for your trade"
        action={
          <Button variant="outline" onClick={() => window.location.href = '/job-forms'} data-testid="button-my-forms">
            My Forms
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KPIBox
          title="Available Forms"
          value={stats.total}
          icon={Store}
        />
        <KPIBox
          title="Installed"
          value={stats.installed}
          icon={Download}
        />
        <KPIBox
          title="Categories"
          value={stats.categories}
          icon={TrendingUp}
        />
      </div>

      <div className="space-y-4 mb-6">
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search forms by name, description, or tags..."
          data-testid="input-search-forms"
        />
        <div className="space-y-2">
          <FilterChips
            chips={categoryChips}
            activeId={categoryFilter}
            onSelect={setCategoryFilter}
          />
          <FilterChips
            chips={tradeTypeChips}
            activeId={tradeTypeFilter}
            onSelect={setTradeTypeFilter}
          />
        </div>
      </div>

      {templatesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full mt-2" />
              </CardHeader>
              <CardContent className="pb-2">
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
              <CardFooter className="pt-2">
                <Skeleton className="h-9 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <EmptyState
          icon={<Store className="h-12 w-12" />}
          title="No forms found"
          description={searchTerm 
            ? "Try adjusting your search or filters" 
            : "No forms available in this category"}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => {
            const isInstalled = installedIds.has(template.id);
            const fields = (template.fields as any[]) || [];
            
            return (
              <Card 
                key={template.id} 
                className={cn(
                  "overflow-hidden hover-elevate cursor-pointer transition-all",
                  isInstalled && "border-green-500/30 bg-green-500/5"
                )}
                onClick={() => handlePreview(template)}
                data-testid={`card-form-${template.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(template.category)}
                      <CardTitle className="text-base line-clamp-1">{template.name}</CardTitle>
                    </div>
                    {isInstalled && (
                      <Badge variant="secondary" className="bg-green-500/20 text-green-600 shrink-0">
                        <Check className="h-3 w-3 mr-1" />
                        Installed
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="line-clamp-2 text-sm">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="flex flex-wrap gap-1 mb-2">
                    <Badge variant="outline" className="text-xs">
                      {getTradeTypeIcon(template.tradeType)}
                      <span className="ml-1 capitalize">{template.tradeType}</span>
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {fields.length} fields
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {template.downloadCount || 0}
                    </span>
                    {template.rating && parseFloat(String(template.rating)) > 0 && (
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {parseFloat(String(template.rating)).toFixed(1)}
                      </span>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="pt-2">
                  <Button 
                    variant={isInstalled ? "outline" : "default"}
                    size="sm"
                    className="w-full"
                    disabled={isInstalled || installMutation.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isInstalled) handleInstall(template.id);
                    }}
                    data-testid={`button-install-${template.id}`}
                  >
                    {isInstalled ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Already Installed
                      </>
                    ) : installMutation.isPending ? (
                      "Installing..."
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Install Form
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          {selectedTemplate && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  {getCategoryIcon(selectedTemplate.category)}
                  <DialogTitle>{selectedTemplate.name}</DialogTitle>
                </div>
                <DialogDescription>
                  {selectedTemplate.description}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {getCategoryIcon(selectedTemplate.category)}
                    <span className="ml-1 capitalize">{selectedTemplate.category}</span>
                  </Badge>
                  <Badge variant="outline">
                    {getTradeTypeIcon(selectedTemplate.tradeType)}
                    <span className="ml-1 capitalize">{selectedTemplate.tradeType}</span>
                  </Badge>
                  {selectedTemplate.tags?.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Download className="h-4 w-4" />
                    {selectedTemplate.downloadCount || 0} downloads
                  </span>
                  {selectedTemplate.rating && parseFloat(String(selectedTemplate.rating)) > 0 && (
                    <span className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      {parseFloat(String(selectedTemplate.rating)).toFixed(1)} ({selectedTemplate.ratingCount || 0} ratings)
                    </span>
                  )}
                  <span>Version {selectedTemplate.version}</span>
                  <span>By {selectedTemplate.author}</span>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Form Fields ({((selectedTemplate.fields as any[]) || []).length})</h4>
                  <ScrollArea className="h-[200px] border rounded-md p-3">
                    <div className="space-y-2">
                      {((selectedTemplate.fields as any[]) || []).map((field, index) => (
                        <div 
                          key={index} 
                          className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground w-6">{index + 1}.</span>
                            <span className="text-sm font-medium">{field.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs capitalize">
                              {field.type}
                            </Badge>
                            {field.required && (
                              <Badge variant="destructive" className="text-xs">
                                Required
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                  Close
                </Button>
                <Button 
                  disabled={installedIds.has(selectedTemplate.id) || installMutation.isPending}
                  onClick={() => handleInstall(selectedTemplate.id)}
                  data-testid="button-install-preview"
                >
                  {installedIds.has(selectedTemplate.id) ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Already Installed
                    </>
                  ) : installMutation.isPending ? (
                    "Installing..."
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Install Form
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
