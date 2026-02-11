import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Link2, Camera, ChevronDown, ChevronUp, Check, Loader2, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface LinkedJobsCardProps {
  jobId: string;
  clientId: string | null;
  clientName: string;
}

interface LinkedJob {
  id: string;
  title: string;
  description?: string;
  clientId?: string;
  status: string;
  createdAt: string;
}

interface PhotoItem {
  id: string;
  objectStorageKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: string;
  caption?: string;
  createdAt: string;
}

const STATUS_BADGE_CONFIG: Record<string, { variant?: "secondary" | "outline"; style?: Record<string, string> }> = {
  enquiry: { variant: "secondary" },
  quoted: { variant: "outline" },
  accepted: {
    style: { backgroundColor: 'hsl(217.2 91.2% 59.8% / 0.15)', color: 'hsl(217.2 91.2% 59.8%)' },
  },
  in_progress: {
    style: { backgroundColor: 'hsl(45 93% 47% / 0.15)', color: 'hsl(45 93% 47%)' },
  },
  done: {
    style: { backgroundColor: 'hsl(142.1 76.2% 36.3% / 0.15)', color: 'hsl(142.1 76.2% 36.3%)' },
  },
  invoiced: {
    style: { backgroundColor: 'hsl(262.1 83.3% 57.8% / 0.15)', color: 'hsl(262.1 83.3% 57.8%)' },
  },
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function LinkedJobsCard({ jobId, clientId, clientName }: LinkedJobsCardProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [expanded, setExpanded] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [sourceJob, setSourceJob] = useState<LinkedJob | null>(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());

  const { data: allJobs = [], isLoading } = useQuery<LinkedJob[]>({
    queryKey: ['/api/jobs'],
  });

  const linkedJobs = clientId
    ? allJobs
        .filter((j) => j.clientId === clientId && j.id !== jobId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];

  const sourceJobId = sourceJob?.id || null;

  const { data: sourcePhotos = [], isLoading: photosLoading } = useQuery<PhotoItem[]>({
    queryKey: ['/api/jobs', sourceJobId, 'photos'],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${sourceJobId}/photos`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!sourceJobId,
  });

  const copyMutation = useMutation({
    mutationFn: async (data: { sourceJobId: string; photoIds: string[] }) => {
      return apiRequest('POST', `/api/jobs/${jobId}/photos/copy`, data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'photos'] });
      toast({
        title: `${variables.photoIds.length} photos copied successfully`,
      });
      setCopyDialogOpen(false);
      setSourceJob(null);
      setSelectedPhotoIds(new Set());
    },
    onError: (error: any) => {
      toast({
        title: "Copy failed",
        description: error.message || "Failed to copy photos",
        variant: "destructive",
      });
    },
  });

  if (!clientId || isLoading || linkedJobs.length === 0) {
    return null;
  }

  const displayedJobs = expanded ? linkedJobs : linkedJobs.slice(0, 3);

  const handleCopyPhotosClick = (e: React.MouseEvent, job: LinkedJob) => {
    e.stopPropagation();
    setSourceJob(job);
    setSelectedPhotoIds(new Set());
    setCopyDialogOpen(true);
  };

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotoIds(prev => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPhotoIds.size === sourcePhotos.length) {
      setSelectedPhotoIds(new Set());
    } else {
      setSelectedPhotoIds(new Set(sourcePhotos.map(p => p.id)));
    }
  };

  const handleCopy = () => {
    if (!sourceJob || selectedPhotoIds.size === 0) return;
    copyMutation.mutate({
      sourceJobId: sourceJob.id,
      photoIds: Array.from(selectedPhotoIds),
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Client History
            </CardTitle>
            <Badge variant="secondary">{linkedJobs.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {displayedJobs.map((job) => {
            const config = STATUS_BADGE_CONFIG[job.status] || {};
            return (
              <div
                key={job.id}
                className="flex items-center justify-between gap-2 p-2 rounded-md cursor-pointer hover-elevate"
                onClick={() => navigate(`/jobs/${job.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{job.title || job.description || 'Untitled Job'}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(job.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge
                    variant={config.variant || "secondary"}
                    style={config.style}
                    className="no-default-hover-elevate no-default-active-elevate"
                  >
                    {formatStatus(job.status)}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => handleCopyPhotosClick(e, job)}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}

          {linkedJobs.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  View all {linkedJobs.length} jobs
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={copyDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setCopyDialogOpen(false);
          setSourceJob(null);
          setSelectedPhotoIds(new Set());
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Copy Photos from {sourceJob?.title || 'Job'}</DialogTitle>
          </DialogHeader>

          {photosLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sourcePhotos.length === 0 ? (
            <div className="text-center py-8">
              <ImageIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No photos found for this job</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {selectedPhotoIds.size} of {sourcePhotos.length} selected
                </p>
                <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                  {selectedPhotoIds.size === sourcePhotos.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[40vh] overflow-y-auto">
                {sourcePhotos.map((photo) => {
                  const isSelected = selectedPhotoIds.has(photo.id);
                  return (
                    <button
                      key={photo.id}
                      className={`relative aspect-square rounded-md overflow-hidden bg-muted focus:outline-none ${isSelected ? 'ring-2 ring-primary' : ''}`}
                      onClick={() => togglePhotoSelection(photo.id)}
                    >
                      <img
                        src={`/api/jobs/${sourceJobId}/photos/${photo.id}/view`}
                        alt={photo.fileName}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {isSelected && (
                        <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                        <p className="text-[10px] text-white truncate">{photo.fileName}</p>
                        <p className="text-[9px] text-white/70 capitalize">{photo.category}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => {
              setCopyDialogOpen(false);
              setSourceJob(null);
              setSelectedPhotoIds(new Set());
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleCopy}
              disabled={selectedPhotoIds.size === 0 || copyMutation.isPending}
            >
              {copyMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Copying...
                </>
              ) : (
                `Copy ${selectedPhotoIds.size} Photo${selectedPhotoIds.size !== 1 ? 's' : ''}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
