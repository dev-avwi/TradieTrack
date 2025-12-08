import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Play, Pause, Trash2, Clock, Volume2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface VoiceNote {
  id: string;
  jobId: string;
  audioUrl: string;
  duration: number;
  transcription?: string;
  createdAt: string;
}

interface VoiceNotesProps {
  jobId: string;
  canRecord?: boolean;
}

export function VoiceNotes({ jobId, canRecord = true }: VoiceNotesProps) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: voiceNotes = [], isLoading } = useQuery<VoiceNote[]>({
    queryKey: ['/api/jobs', jobId, 'voice-notes'],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/voice-notes`, { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error('Failed to fetch voice notes');
      }
      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (audioBlob: Blob) => {
      // Convert blob to base64 (same pattern as photo uploads)
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      
      const res = await fetch(`/api/jobs/${jobId}/voice-notes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64,
          duration: recordingDuration,
          mimeType: audioBlob.type || 'audio/webm',
        }),
      });
      
      if (!res.ok) throw new Error('Failed to upload voice note');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'voice-notes'] });
      toast({
        title: "Voice Note Saved",
        description: "Your voice note has been saved to this job",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save voice note",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      return await apiRequest("DELETE", `/api/jobs/${jobId}/voice-notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'voice-notes'] });
      toast({
        title: "Deleted",
        description: "Voice note has been removed",
      });
    },
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        uploadMutation.mutate(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      toast({
        title: "Microphone Access Denied",
        description: "Please allow microphone access to record voice notes",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const playVoiceNote = (note: VoiceNote) => {
    if (playingId === note.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(note.audioUrl);
      audioRef.current.onended = () => setPlayingId(null);
      audioRef.current.play();
      setPlayingId(note.id);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card data-testid="voice-notes-section">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Volume2 className="h-4 w-4" />
          Voice Notes
          {voiceNotes.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {voiceNotes.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {canRecord && (
          <div className="flex items-center gap-2">
            {!isRecording ? (
              <Button
                variant="outline"
                className="flex-1 h-14"
                onClick={startRecording}
                disabled={uploadMutation.isPending}
                data-testid="button-start-recording"
              >
                <Mic className="h-5 w-5 mr-2" style={{ color: 'hsl(0 84% 60%)' }} />
                Tap to Record
              </Button>
            ) : (
              <Button
                variant="destructive"
                className="flex-1 h-14 animate-pulse"
                onClick={stopRecording}
                data-testid="button-stop-recording"
              >
                <MicOff className="h-5 w-5 mr-2" />
                Recording... {formatDuration(recordingDuration)} - Tap to Stop
              </Button>
            )}
          </div>
        )}

        {uploadMutation.isPending && (
          <div className="flex items-center justify-center py-3">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full mr-2" />
            <span className="text-sm text-muted-foreground">Saving voice note...</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Loading voice notes...
          </div>
        ) : voiceNotes.length === 0 && !canRecord ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            No voice notes recorded for this job
          </div>
        ) : voiceNotes.length > 0 ? (
          <div className="space-y-2">
            {voiceNotes.map((note) => (
              <div
                key={note.id}
                className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30"
                data-testid={`voice-note-${note.id}`}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={() => playVoiceNote(note)}
                  data-testid={`button-play-${note.id}`}
                >
                  {playingId === note.id ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                </Button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {formatDuration(note.duration)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(note.createdAt), 'MMM d, h:mm a')}
                  </p>
                  {note.transcription && (
                    <p className="text-sm mt-1 line-clamp-2">{note.transcription}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate(note.id)}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-${note.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
