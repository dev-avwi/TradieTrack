import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { VoiceRecorder, VoiceNotePlayer } from '@/components/ui/voice-recorder';
import { Mic, Plus, Loader2, Sparkles, FileText } from 'lucide-react';
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

  const transcribeMutation = useMutation({
    mutationFn: async (voiceNoteId: string) => {
      return apiRequest('POST', `/api/jobs/${jobId}/voice-notes/${voiceNoteId}/transcribe`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'voice-notes'] });
      toast({
        title: 'Transcription complete',
        description: 'Your voice note has been transcribed using AI.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Transcription failed',
        description: error.message || 'Failed to transcribe voice note.',
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
          <div className="space-y-3">
            {voiceNotes.map((note) => (
              <div key={note.id} className="space-y-2">
                <VoiceNotePlayer
                  signedUrl={note.signedUrl || ''}
                  fallbackUrl={`/api/jobs/${jobId}/voice-notes/${note.id}/stream`}
                  title={note.title || undefined}
                  duration={note.duration || undefined}
                  createdAt={note.createdAt || undefined}
                  onDelete={canUpload ? () => deleteMutation.mutate(note.id) : undefined}
                />
                {note.transcription ? (
                  <div className="bg-muted/50 rounded-md p-3 ml-2 border-l-2 border-primary/30">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">AI Transcription</span>
                    </div>
                    <p className="text-sm leading-relaxed" data-testid={`transcription-${note.id}`}>
                      {note.transcription}
                    </p>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2 text-xs"
                    onClick={() => transcribeMutation.mutate(note.id)}
                    disabled={transcribeMutation.isPending}
                    data-testid={`button-transcribe-${note.id}`}
                  >
                    {transcribeMutation.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3 mr-1" />
                    )}
                    {transcribeMutation.isPending ? 'Transcribing...' : 'AI Transcribe'}
                  </Button>
                )}
              </div>
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
