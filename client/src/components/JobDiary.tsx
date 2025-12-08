import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Book, 
  Plus, 
  Clock, 
  CheckCircle, 
  Camera, 
  Mail, 
  MessageSquare, 
  DollarSign,
  MapPin,
  FileText,
  Edit2,
  Phone,
  Package,
  AlertTriangle,
  Trash2,
  User,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface JobActivity {
  id: string;
  jobId: string;
  userId?: string;
  activityType: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  relatedEntityType?: string;
  relatedEntityId?: string;
  isSystemGenerated?: boolean;
  createdAt: string;
  userName?: string;
}

interface JobDiaryProps {
  jobId: string;
}

const ACTIVITY_TYPES = [
  { value: 'note', label: 'Note', icon: Edit2, color: 'bg-blue-500' },
  { value: 'status_change', label: 'Status Change', icon: CheckCircle, color: 'bg-green-500' },
  { value: 'photo', label: 'Photo Added', icon: Camera, color: 'bg-purple-500' },
  { value: 'email_sent', label: 'Email Sent', icon: Mail, color: 'bg-orange-500' },
  { value: 'sms_sent', label: 'SMS Sent', icon: MessageSquare, color: 'bg-teal-500' },
  { value: 'call', label: 'Phone Call', icon: Phone, color: 'bg-cyan-500' },
  { value: 'payment', label: 'Payment', icon: DollarSign, color: 'bg-emerald-500' },
  { value: 'checkin', label: 'Check In', icon: MapPin, color: 'bg-indigo-500' },
  { value: 'checkout', label: 'Check Out', icon: MapPin, color: 'bg-rose-500' },
  { value: 'form_submitted', label: 'Form Submitted', icon: FileText, color: 'bg-amber-500' },
  { value: 'signature', label: 'Signature', icon: Edit2, color: 'bg-violet-500' },
  { value: 'quote_sent', label: 'Quote Sent', icon: FileText, color: 'bg-blue-400' },
  { value: 'invoice_sent', label: 'Invoice Sent', icon: FileText, color: 'bg-green-400' },
  { value: 'material_added', label: 'Material Added', icon: Package, color: 'bg-yellow-500' },
  { value: 'issue', label: 'Issue/Problem', icon: AlertTriangle, color: 'bg-red-500' },
];

function getActivityIcon(type: string) {
  const activityType = ACTIVITY_TYPES.find(t => t.value === type);
  return activityType?.icon || Edit2;
}

function getActivityColor(type: string) {
  const activityType = ACTIVITY_TYPES.find(t => t.value === type);
  return activityType?.color || 'bg-gray-500';
}

export function JobDiary({ jobId }: JobDiaryProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [newEntry, setNewEntry] = useState({
    activityType: 'note',
    title: '',
    description: '',
  });

  const { data: activities = [], isLoading } = useQuery<JobActivity[]>({
    queryKey: ['/api/jobs', jobId, 'activities'],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/activities`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch job activities');
      return res.json();
    },
  });

  const addActivityMutation = useMutation({
    mutationFn: async (data: { activityType: string; title: string; description: string }) => {
      return await apiRequest("POST", `/api/jobs/${jobId}/activities`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'activities'] });
      toast({
        title: "Entry Added",
        description: "New diary entry has been added",
      });
      setIsAddingEntry(false);
      setNewEntry({ activityType: 'note', title: '', description: '' });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add diary entry",
        variant: "destructive",
      });
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      return await apiRequest("DELETE", `/api/jobs/${jobId}/activities/${activityId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'activities'] });
      toast({
        title: "Entry Deleted",
        description: "Diary entry has been removed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete diary entry",
        variant: "destructive",
      });
    },
  });

  const handleAddEntry = () => {
    if (!newEntry.title.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a title for this entry",
        variant: "destructive",
      });
      return;
    }
    addActivityMutation.mutate(newEntry);
  };

  const groupedActivities = useMemo(() => {
    const groups: Record<string, JobActivity[]> = {};
    activities.forEach(activity => {
      const date = format(new Date(activity.createdAt), 'yyyy-MM-dd');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(activity);
    });
    return groups;
  }, [activities]);

  const sortedDates = Object.keys(groupedActivities).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <Card data-testid="card-job-diary">
      <CardHeader className="pb-3 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Book className="h-4 w-4" />
            Job Diary
            {activities.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activities.length} {activities.length === 1 ? 'entry' : 'entries'}
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          <Dialog open={isAddingEntry} onOpenChange={setIsAddingEntry}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full"
                data-testid="button-add-diary-entry"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Entry
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Diary Entry</DialogTitle>
                <DialogDescription>
                  Record notes, calls, issues, or any important updates for this job.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Entry Type</label>
                  <Select
                    value={newEntry.activityType}
                    onValueChange={(value) => setNewEntry({ ...newEntry, activityType: value })}
                  >
                    <SelectTrigger data-testid="select-activity-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="note">Note</SelectItem>
                      <SelectItem value="call">Phone Call</SelectItem>
                      <SelectItem value="issue">Issue/Problem</SelectItem>
                      <SelectItem value="material_added">Material Added</SelectItem>
                      <SelectItem value="email_sent">Email Sent</SelectItem>
                      <SelectItem value="sms_sent">SMS Sent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    placeholder="Brief summary..."
                    value={newEntry.title}
                    onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                    data-testid="input-activity-title"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Details (optional)</label>
                  <Textarea
                    placeholder="Add more details..."
                    value={newEntry.description}
                    onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                    rows={3}
                    data-testid="input-activity-description"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddingEntry(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddEntry}
                  disabled={addActivityMutation.isPending}
                  data-testid="button-save-diary-entry"
                >
                  {addActivityMutation.isPending ? 'Saving...' : 'Save Entry'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {isLoading ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Loading diary entries...
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Book className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No diary entries yet</p>
              <p className="text-xs mt-1">Add notes, calls, and updates as work progresses</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedDates.map((date) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs font-medium text-muted-foreground px-2">
                      {format(new Date(date), 'EEEE, d MMMM yyyy')}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  
                  <div className="space-y-2">
                    {groupedActivities[date].map((activity) => {
                      const Icon = getActivityIcon(activity.activityType);
                      const color = getActivityColor(activity.activityType);
                      
                      return (
                        <div 
                          key={activity.id}
                          className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors group"
                          data-testid={`diary-entry-${activity.id}`}
                        >
                          <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center flex-shrink-0`}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium text-sm">{activity.title}</p>
                                {activity.description && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {activity.description}
                                  </p>
                                )}
                              </div>
                              
                              {!activity.isSystemGenerated && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => deleteActivityMutation.mutate(activity.id)}
                                >
                                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                                </Button>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(activity.createdAt), 'h:mm a')}
                              </span>
                              {activity.userName && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {activity.userName}
                                </span>
                              )}
                              {activity.isSystemGenerated && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1">
                                  Auto
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default JobDiary;
