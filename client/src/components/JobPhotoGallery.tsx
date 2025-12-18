import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Camera, Plus, Trash2, X, Loader2, Image as ImageIcon, CheckCircle2, Video, Film, Download } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface JobPhoto {
  id: string;
  objectStorageKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: 'before' | 'after' | 'progress' | 'materials' | 'general';
  caption?: string;
  takenAt?: string;
  createdAt: string;
  signedUrl?: string;
}

interface JobPhotoGalleryProps {
  jobId: string;
  canUpload?: boolean;
  onPhotoUploaded?: () => void;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  before: { label: 'Before', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  after: { label: 'After', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  progress: { label: 'Progress', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  materials: { label: 'Materials', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  general: { label: 'General', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' },
};

export default function JobPhotoGallery({ jobId, canUpload = true, onPhotoUploaded }: JobPhotoGalleryProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('general');
  const [caption, setCaption] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<JobPhoto | null>(null);

  const { data: photos = [], isLoading } = useQuery<JobPhoto[]>({
    queryKey: ['/api/jobs', jobId, 'photos'],
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { 
      fileName: string; 
      fileBase64: string; 
      mimeType: string; 
      category: string; 
      caption?: string;
      takenAt?: string;
    }) => {
      return await apiRequest('POST', `/api/jobs/${jobId}/photos`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'photos'] });
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      setCaption('');
      setSelectedCategory('general');
      toast({
        title: "Photo uploaded",
        description: "Your photo has been added to this job",
      });
      onPhotoUploaded?.();
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload photo",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (photoId: string) => {
      return await apiRequest('DELETE', `/api/jobs/${jobId}/photos/${photoId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'photos'] });
      setSelectedPhoto(null);
      toast({
        title: "Photo deleted",
        description: "The photo has been removed from this job",
      });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Failed to delete photo",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 10MB",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target?.result as string);
      reader.readAsDataURL(file);
      setIsUploadDialogOpen(true);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a photo to upload",
        variant: "destructive",
      });
      return;
    }
    
    if (!previewUrl) {
      toast({
        title: "Photo not ready",
        description: "Please wait for the photo to load before uploading",
        variant: "destructive",
      });
      return;
    }

    const base64Data = previewUrl.split(',')[1];
    
    uploadMutation.mutate({
      fileName: selectedFile.name,
      fileBase64: base64Data,
      mimeType: selectedFile.type,
      category: selectedCategory,
      caption: caption || undefined,
      takenAt: new Date().toISOString(),
    });
  };

  const groupedPhotos = photos.reduce((acc, photo) => {
    const category = photo.category || 'general';
    if (!acc[category]) acc[category] = [];
    acc[category].push(photo);
    return acc;
  }, {} as Record<string, JobPhoto[]>);

  return (
    <Card data-testid="job-photo-gallery">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Film className="h-4 w-4" />
            Media {photos.length > 0 && `(${photos.length})`}
          </CardTitle>
          {canUpload && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-add-photo"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Media
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-8">
            <Film className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground mb-3">
              No media yet
            </p>
            {canUpload && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-upload-first-photo"
              >
                <Camera className="h-4 w-4 mr-2" />
                Take or Upload Media
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Display photos grouped by category */}
            {Object.entries(CATEGORY_LABELS).map(([category, { label }]) => {
              const categoryPhotos = groupedPhotos[category];
              if (!categoryPhotos?.length) return null;

              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className={CATEGORY_LABELS[category].color}>
                      {label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {categoryPhotos.length} {categoryPhotos.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {categoryPhotos.map((photo) => {
                      const isVideo = photo.mimeType?.startsWith('video/');
                      return (
                        <button
                          key={photo.id}
                          className="aspect-square rounded-lg overflow-hidden bg-muted hover-elevate focus:ring-2 focus:ring-primary focus:outline-none relative"
                          onClick={() => setSelectedPhoto(photo)}
                          data-testid={`photo-${photo.id}`}
                        >
                          {isVideo ? (
                            <>
                              <video
                                src={photo.signedUrl || `/api/jobs/${jobId}/photos/${photo.id}/view`}
                                className="w-full h-full object-cover"
                                muted
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <Video className="h-8 w-8 text-white" />
                              </div>
                            </>
                          ) : (
                            <img
                              src={photo.signedUrl || `/api/jobs/${jobId}/photos/${photo.id}/view`}
                              alt={photo.caption || photo.fileName}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            
            {/* Also show any photos with unexpected categories */}
            {Object.keys(groupedPhotos)
              .filter(category => !CATEGORY_LABELS[category])
              .map(category => {
                const categoryPhotos = groupedPhotos[category];
                if (!categoryPhotos?.length) return null;
                
                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">
                        {category || 'Uncategorized'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {categoryPhotos.length} {categoryPhotos.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {categoryPhotos.map((photo) => {
                        const isVideo = photo.mimeType?.startsWith('video/');
                        return (
                          <button
                            key={photo.id}
                            className="aspect-square rounded-lg overflow-hidden bg-muted hover-elevate focus:ring-2 focus:ring-primary focus:outline-none relative"
                            onClick={() => setSelectedPhoto(photo)}
                            data-testid={`photo-${photo.id}`}
                          >
                            {isVideo ? (
                              <>
                                <video
                                  src={photo.signedUrl || `/api/jobs/${jobId}/photos/${photo.id}/view`}
                                  className="w-full h-full object-cover"
                                  muted
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                  <Video className="h-8 w-8 text-white" />
                                </div>
                              </>
                            ) : (
                              <img
                                src={photo.signedUrl || `/api/jobs/${jobId}/photos/${photo.id}/view`}
                                alt={photo.caption || photo.fileName}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </CardContent>

      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Photo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {previewUrl && (
              <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger data-testid="select-photo-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">Before (starting condition)</SelectItem>
                  <SelectItem value="progress">Progress (during work)</SelectItem>
                  <SelectItem value="after">After (completed work)</SelectItem>
                  <SelectItem value="materials">Materials (supplies used)</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Categorize your photos to keep them organized
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="caption">Caption (optional)</Label>
              <Input
                id="caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a description..."
                data-testid="input-photo-caption"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setIsUploadDialogOpen(false);
                setSelectedFile(null);
                setPreviewUrl(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploadMutation.isPending}
              data-testid="button-confirm-upload"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                {selectedPhoto?.caption || selectedPhoto?.fileName || 'Photo'}
                {selectedPhoto?.category && (
                  <Badge variant="secondary" className={CATEGORY_LABELS[selectedPhoto.category]?.color}>
                    {CATEGORY_LABELS[selectedPhoto.category]?.label}
                  </Badge>
                )}
              </DialogTitle>
            </div>
          </DialogHeader>

          {selectedPhoto && (() => {
            const isVideo = selectedPhoto.mimeType?.startsWith('video/');
            const mediaUrl = selectedPhoto.signedUrl || `/api/jobs/${jobId}/photos/${selectedPhoto.id}/view`;
            
            const handleDownload = () => {
              try {
                // Use the /download endpoint which adds Content-Disposition headers
                const downloadUrl = `/api/jobs/${jobId}/photos/${selectedPhoto.id}/download`;
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = selectedPhoto.fileName || (isVideo ? 'video.mp4' : 'photo.jpg');
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                toast({
                  title: "Download started",
                  description: `${isVideo ? 'Video' : 'Photo'} is being saved to your device`,
                });
              } catch (error) {
                console.error('Download error:', error);
                toast({
                  title: "Download failed",
                  description: "Unable to download file. Please try again.",
                  variant: "destructive",
                });
              }
            };
            
            return (
              <div className="space-y-4">
                <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                  {isVideo ? (
                    <video
                      src={mediaUrl}
                      controls
                      autoPlay={false}
                      playsInline
                      className="w-full h-full object-contain"
                      data-testid="video-player"
                    >
                      <source src={mediaUrl} type={selectedPhoto.mimeType || 'video/mp4'} />
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <img
                      src={mediaUrl}
                      alt={selectedPhoto.caption || selectedPhoto.fileName}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {selectedPhoto.createdAt ? (
                      <>Uploaded {new Date(selectedPhoto.createdAt).toLocaleDateString('en-AU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}</>
                    ) : 'Date unknown'}
                  </span>
                  <span>
                    {selectedPhoto.fileSize ? `${(selectedPhoto.fileSize / 1024).toFixed(0)} KB` : ''}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    data-testid="button-download-media"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Save {isVideo ? 'Video' : 'Photo'}
                  </Button>
                  
                  {canUpload && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(selectedPhoto.id)}
                      disabled={deleteMutation.isPending}
                      data-testid="button-delete-photo"
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Delete {isVideo ? 'Video' : 'Photo'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
