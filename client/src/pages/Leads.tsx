import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  MoreVertical,
  Users,
  Phone,
  Mail,
  Globe,
  UserPlus,
  MessageSquare,
  Calendar as CalendarIcon,
  Trash2,
  Edit,
  DollarSign,
  ArrowRight,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Briefcase,
} from "lucide-react";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/compact-card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Lead, Client } from "@shared/schema";

type LeadSource = 'phone' | 'email' | 'website' | 'referral' | 'other';
type LeadStatus = 'new' | 'contacted' | 'quoted' | 'won' | 'lost';

const sourceLabels: Record<LeadSource, string> = {
  phone: 'Phone',
  email: 'Email',
  website: 'Website',
  referral: 'Referral',
  other: 'Other',
};

const sourceIcons: Record<LeadSource, typeof Phone> = {
  phone: Phone,
  email: Mail,
  website: Globe,
  referral: UserPlus,
  other: MessageSquare,
};

const statusLabels: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  quoted: 'Quoted',
  won: 'Won',
  lost: 'Lost',
};

const statusColors: Record<LeadStatus, string> = {
  new: 'bg-primary/10 text-primary',
  contacted: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  quoted: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  won: 'bg-success/10 text-success',
  lost: 'bg-destructive/10 text-destructive',
};

const columnOrder: LeadStatus[] = ['new', 'contacted', 'quoted', 'won', 'lost'];

export default function Leads() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [leadToConvert, setLeadToConvert] = useState<Lead | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<LeadSource | 'all'>('all');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    source: 'other' as LeadSource,
    status: 'new' as LeadStatus,
    description: '',
    estimatedValue: '',
    notes: '',
    followUpDate: null as Date | null,
  });
  const [convertOptions, setConvertOptions] = useState({
    createJob: false,
    createQuote: false,
  });

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ['/api/leads'],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch = searchQuery === '' ||
        lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;
      
      return matchesSearch && matchesSource;
    });
  }, [leads, searchQuery, sourceFilter]);

  const leadsByStatus = useMemo(() => {
    const grouped: Record<LeadStatus, Lead[]> = {
      new: [],
      contacted: [],
      quoted: [],
      won: [],
      lost: [],
    };
    
    filteredLeads.forEach((lead) => {
      const status = (lead.status || 'new') as LeadStatus;
      grouped[status]?.push(lead);
    });
    
    return grouped;
  }, [filteredLeads]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/leads', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      setCreateDialogOpen(false);
      resetForm();
      toast({ title: 'Lead created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create lead', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest(`/api/leads/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      setEditingLead(null);
      resetForm();
      toast({ title: 'Lead updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update lead', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/leads/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({ title: 'Lead deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete lead', variant: 'destructive' });
    },
  });

  const convertMutation = useMutation({
    mutationFn: async ({ id, createJob, createQuote }: { id: string; createJob: boolean; createQuote: boolean }) => {
      return apiRequest(`/api/leads/${id}/convert`, {
        method: 'POST',
        body: JSON.stringify({ createJob, createQuote }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      setConvertDialogOpen(false);
      setLeadToConvert(null);
      setConvertOptions({ createJob: false, createQuote: false });
      toast({ title: 'Lead converted to client successfully' });
      
      if (data?.client?.id) {
        navigate(`/clients/${data.client.id}`);
      }
    },
    onError: () => {
      toast({ title: 'Failed to convert lead', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      source: 'other',
      status: 'new',
      description: '',
      estimatedValue: '',
      notes: '',
      followUpDate: null,
    });
  };

  const handleSubmit = () => {
    const data = {
      ...formData,
      estimatedValue: formData.estimatedValue ? parseFloat(formData.estimatedValue).toFixed(2) : null,
      followUpDate: formData.followUpDate?.toISOString() || null,
    };

    if (editingLead) {
      updateMutation.mutate({ id: editingLead.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (lead: Lead) => {
    setFormData({
      name: lead.name,
      email: lead.email || '',
      phone: lead.phone || '',
      source: (lead.source || 'other') as LeadSource,
      status: (lead.status || 'new') as LeadStatus,
      description: lead.description || '',
      estimatedValue: lead.estimatedValue || '',
      notes: lead.notes || '',
      followUpDate: lead.followUpDate ? new Date(lead.followUpDate) : null,
    });
    setEditingLead(lead);
  };

  const handleStatusChange = (lead: Lead, newStatus: LeadStatus) => {
    updateMutation.mutate({
      id: lead.id,
      data: { status: newStatus },
    });
  };

  const handleConvert = (lead: Lead) => {
    setLeadToConvert(lead);
    setConvertDialogOpen(true);
  };

  const confirmConvert = () => {
    if (!leadToConvert) return;
    convertMutation.mutate({
      id: leadToConvert.id,
      createJob: convertOptions.createJob,
      createQuote: convertOptions.createQuote,
    });
  };

  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return null;
    const num = parseFloat(value);
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
    }).format(num);
  };

  const LeadCard = ({ lead }: { lead: Lead }) => {
    const SourceIcon = sourceIcons[(lead.source || 'other') as LeadSource] || MessageSquare;
    const isOverdue = lead.followUpDate && new Date(lead.followUpDate) < new Date();
    
    return (
      <Card 
        className="hover-elevate active-elevate-2 cursor-pointer mb-2"
        data-testid={`card-lead-${lead.id}`}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm truncate">{lead.name}</span>
                <Badge variant="outline" className="text-xs shrink-0">
                  <SourceIcon className="w-3 h-3 mr-1" />
                  {sourceLabels[(lead.source || 'other') as LeadSource]}
                </Badge>
              </div>
              
              {lead.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                  {lead.description}
                </p>
              )}
              
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {lead.estimatedValue && (
                  <span className="flex items-center gap-1 text-success font-medium">
                    <DollarSign className="w-3 h-3" />
                    {formatCurrency(lead.estimatedValue)}
                  </span>
                )}
                {lead.followUpDate && (
                  <span className={`flex items-center gap-1 ${isOverdue ? 'text-destructive' : ''}`}>
                    <Clock className="w-3 h-3" />
                    {format(new Date(lead.followUpDate), 'MMM d')}
                  </span>
                )}
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" data-testid={`button-lead-menu-${lead.id}`}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEdit(lead)} data-testid={`menu-edit-lead-${lead.id}`}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                {lead.status !== 'won' && lead.status !== 'lost' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleConvert(lead)} data-testid={`menu-convert-lead-${lead.id}`}>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Convert to Client
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                {columnOrder.filter(s => s !== lead.status).map((status) => (
                  <DropdownMenuItem 
                    key={status} 
                    onClick={() => handleStatusChange(lead, status)}
                    data-testid={`menu-status-${status}-${lead.id}`}
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Move to {statusLabels[status]}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={() => deleteMutation.mutate(lead.id)}
                  data-testid={`menu-delete-lead-${lead.id}`}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    );
  };

  const KanbanColumn = ({ status, leads: columnLeads }: { status: LeadStatus; leads: Lead[] }) => {
    const StatusIcon = status === 'won' ? CheckCircle : status === 'lost' ? XCircle : Clock;
    
    return (
      <div className="flex-shrink-0 w-72 md:w-80">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={statusColors[status]}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusLabels[status]}
            </Badge>
            <span className="text-sm text-muted-foreground">({columnLeads.length})</span>
          </div>
        </div>
        
        <div className="space-y-2 min-h-[200px]">
          {columnLeads.length === 0 ? (
            <div className="h-32 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground text-sm">
              No leads
            </div>
          ) : (
            columnLeads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Leads"
        subtitle="Track enquiries from initial contact to won/lost"
        leading={<Users className="w-5 h-5" style={{ color: 'hsl(var(--trade))' }} />}
        action={
          <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-add-lead">
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </Button>
        }
      />

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-leads"
          />
        </div>
        <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as LeadSource | 'all')}>
          <SelectTrigger className="w-full sm:w-40" data-testid="select-source-filter">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {Object.entries(sourceLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {leads.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={Users}
            title="No leads yet"
            description="Start tracking your enquiries and convert them to clients"
            action={
              <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-add-first-lead">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Lead
              </Button>
            }
          />
        </div>
      ) : (
        <ScrollArea className="mt-6 w-full">
          <div className="flex gap-4 pb-4">
            {columnOrder.map((status) => (
              <KanbanColumn key={status} status={status} leads={leadsByStatus[status]} />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

      <Dialog open={createDialogOpen || !!editingLead} onOpenChange={(open) => {
        if (!open) {
          setCreateDialogOpen(false);
          setEditingLead(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLead ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Lead name"
                data-testid="input-lead-name"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                  data-testid="input-lead-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="0400 000 000"
                  data-testid="input-lead-phone"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Source</Label>
                <Select 
                  value={formData.source} 
                  onValueChange={(v) => setFormData({ ...formData, source: v as LeadSource })}
                >
                  <SelectTrigger data-testid="select-lead-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(sourceLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(v) => setFormData({ ...formData, status: v as LeadStatus })}
                >
                  <SelectTrigger data-testid="select-lead-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the enquiry..."
                rows={2}
                data-testid="textarea-lead-description"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estimatedValue">Estimated Value ($)</Label>
                <Input
                  id="estimatedValue"
                  type="number"
                  value={formData.estimatedValue}
                  onChange={(e) => setFormData({ ...formData, estimatedValue: e.target.value })}
                  placeholder="0.00"
                  data-testid="input-lead-value"
                />
              </div>
              <div className="space-y-2">
                <Label>Follow-up Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start" data-testid="button-lead-followup">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {formData.followUpDate ? format(formData.followUpDate, 'PPP') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.followUpDate || undefined}
                      onSelect={(date) => setFormData({ ...formData, followUpDate: date || null })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
                data-testid="textarea-lead-notes"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateDialogOpen(false); setEditingLead(null); resetForm(); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-lead"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingLead ? 'Update Lead' : 'Create Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convert Lead to Client</DialogTitle>
          </DialogHeader>
          
          {leadToConvert && (
            <div className="py-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Convert <strong>{leadToConvert.name}</strong> to a client. This will mark the lead as won.
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="createJob"
                    checked={convertOptions.createJob}
                    onCheckedChange={(checked) => setConvertOptions({ ...convertOptions, createJob: !!checked })}
                    data-testid="checkbox-create-job"
                  />
                  <Label htmlFor="createJob" className="flex items-center gap-2 cursor-pointer">
                    <Briefcase className="w-4 h-4" />
                    Also create a job
                  </Label>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="createQuote"
                    checked={convertOptions.createQuote}
                    onCheckedChange={(checked) => setConvertOptions({ ...convertOptions, createQuote: !!checked })}
                    data-testid="checkbox-create-quote"
                  />
                  <Label htmlFor="createQuote" className="flex items-center gap-2 cursor-pointer">
                    <FileText className="w-4 h-4" />
                    Also create a quote
                  </Label>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConvertDialogOpen(false); setLeadToConvert(null); }}>
              Cancel
            </Button>
            <Button 
              onClick={confirmConvert} 
              disabled={convertMutation.isPending}
              data-testid="button-confirm-convert"
            >
              {convertMutation.isPending ? 'Converting...' : 'Convert to Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
