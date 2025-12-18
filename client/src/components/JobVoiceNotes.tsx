import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { VoiceRecorder, VoiceNotePlayer } from '@/components/ui/voice-recorder';
import { Mic, Plus, Loader2 } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface VoiceNote {
  id: string;
  fileName: string;
  duration: number | null;
  title: string | null;
  transcription: string | null;
  createdAt: string | null;
  signedUrl?: string;
}

interface JobVoiceNotesProps {
  jobId: string;
  canUpload?: boolean;
}

export function JobVoiceNotes({ jobId, canUpload = true }: JobVoiceNotesProps) {
  const [showRecorder, setShowRecorder] = useState(false);
  const { toast } = useToast();

  const { data: voiceNotes = [], isLoading } = useQuery<VoiceNote[]>({
    queryKey: ['/api/jobs', jobId, 'voice-notes'],
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ audioBlob, duration }: { audioBlob: Blob; duration: number }) => {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(audioBlob);
      });
      const audioData = await base64Promise;
      
      return apiRequest('POST', `/api/jobs/${jobId}/voice-notes`, {
        audioData,
        fileName: `voice-note-${Date.now()}.webm`,
        mimeType: audioBlob.type || 'audio/webm',
        duration,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'voice-notes'] });
      setShowRecorder(false);
      toast({
        title: 'Voice note saved',
        description: 'Your voice note has been uploaded successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload voice note.',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (voiceNoteId: string) => {
      return apiRequest('DELETE', `/api/jobs/${jobId}/voice-notes/${voiceNoteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'voice-notes'] });
      toast({
        title: 'Voice note deleted',
        description: 'The voice note has been removed.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Delete failed',
        description: error.message || 'Failed to delete voice note.',
        variant: 'destructive',
      });
    },
  });

  const handleSave = (audioBlob: Blob, duration: number) => {
    uploadMutation.mutate({ audioBlob, duration });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic className="h-4 w-4" />
            Voice Notes
          </CardTitle>
          {canUpload && !showRecorder && (
            <Button
              onClick={() => setShowRecorder(true)}
              size="sm"
              variant="outline"
              data-testid="button-add-voice-note"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showRecorder && (
          <VoiceRecorder
            onSave={handleSave}
            onCancel={() => setShowRecorder(false)}
            isUploading={uploadMutation.isPending}
          />
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : voiceNotes.length > 0 ? (
          <div className="space-y-2">
            {voiceNotes.map((note) => (
              <VoiceNotePlayer
                key={note.id}
                signedUrl={note.signedUrl || ''}
                title={note.title || undefined}
                duration={note.duration || undefined}
                createdAt={note.createdAt || undefined}
                onDelete={canUpload ? () => deleteMutation.mutate(note.id) : undefined}
              />
            ))}
          </div>
        ) : !showRecorder ? (
          <div className="text-center py-4 text-muted-foreground">
            <Mic className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No voice notes yet</p>
            {canUpload && (
              <p className="text-xs mt-1">Record audio notes for this job</p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
