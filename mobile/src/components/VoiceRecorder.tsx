import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import { useTheme } from '../lib/theme';
import { Ionicons } from '@expo/vector-icons';

interface VoiceRecorderProps {
  onSave: (uri: string, duration: number) => void;
  onCancel?: () => void;
  isUploading?: boolean;
}

export function VoiceRecorder({ onSave, onCancel, isUploading }: VoiceRecorderProps) {
  const theme = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const requestPermissions = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant microphone permission to record voice notes.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const startRecording = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      recordingRef.current = recording;
      setIsRecording(true);
      setDuration(0);
      
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Could not start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      
      setIsRecording(false);
      setIsPaused(false);
      
      if (uri) {
        setRecordedUri(uri);
      }
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  };

  const pauseRecording = async () => {
    if (!recordingRef.current) return;

    try {
      if (isPaused) {
        await recordingRef.current.startAsync();
        timerRef.current = setInterval(() => {
          setDuration(d => d + 1);
        }, 1000);
      } else {
        await recordingRef.current.pauseAsync();
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
      setIsPaused(!isPaused);
    } catch (error) {
      console.error('Error pausing recording:', error);
    }
  };

  const playRecording = async () => {
    if (!recordedUri) return;

    try {
      if (isPlaying && soundRef.current) {
        await soundRef.current.stopAsync();
        setIsPlaying(false);
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: recordedUri },
        { shouldPlay: true }
      );
      
      soundRef.current = sound;
      setIsPlaying(true);
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
      
    } catch (error) {
      console.error('Error playing recording:', error);
    }
  };

  const deleteRecording = async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setRecordedUri(null);
    setDuration(0);
    setIsPlaying(false);
  };

  const handleSave = () => {
    if (recordedUri) {
      onSave(recordedUri, duration);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      {!recordedUri ? (
        <>
          <View style={[styles.micContainer, isRecording && styles.micRecording]}>
            <Ionicons 
              name="mic" 
              size={32} 
              color={isRecording ? theme.colors.error : theme.colors.primary} 
            />
          </View>
          
          <Text style={styles.duration}>{formatDuration(duration)}</Text>
          
          <View style={styles.buttonRow}>
            {!isRecording ? (
              <TouchableOpacity 
                style={[styles.button, styles.primaryButton]}
                onPress={startRecording}
              >
                <Ionicons name="mic" size={20} color="#ffffff" />
                <Text style={styles.buttonTextWhite}>Start Recording</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity 
                  style={[styles.button, styles.outlineButton]}
                  onPress={pauseRecording}
                >
                  <Ionicons 
                    name={isPaused ? "play" : "pause"} 
                    size={20} 
                    color={theme.colors.primary} 
                  />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.button, styles.stopButton]}
                  onPress={stopRecording}
                >
                  <Ionicons name="stop" size={20} color="#ffffff" />
                  <Text style={styles.buttonTextWhite}>Stop</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </>
      ) : (
        <>
          <View style={styles.playbackContainer}>
            <TouchableOpacity 
              style={styles.playButton}
              onPress={playRecording}
            >
              <Ionicons 
                name={isPlaying ? "pause" : "play"} 
                size={24} 
                color={theme.colors.primary} 
              />
            </TouchableOpacity>
            <View style={styles.playbackInfo}>
              <Text style={styles.playbackTitle}>Voice Note</Text>
              <Text style={styles.playbackDuration}>{formatDuration(duration)}</Text>
            </View>
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={deleteRecording}
            >
              <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.actionRow}>
            {onCancel && (
              <TouchableOpacity 
                style={[styles.button, styles.outlineButton, styles.flex1]}
                onPress={onCancel}
                disabled={isUploading}
              >
                <Text style={[styles.buttonText, isUploading && styles.disabledText]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[
                styles.button, 
                styles.primaryButton, 
                styles.flex1,
                isUploading && styles.disabledButton
              ]}
              onPress={handleSave}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.buttonTextWhite}>Saving...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="save" size={20} color="#ffffff" />
                  <Text style={styles.buttonTextWhite}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

interface VoiceNotePlayerProps {
  uri: string;
  title?: string;
  duration?: number;
  createdAt?: string;
  onDelete?: () => void;
}

export function VoiceNotePlayer({ 
  uri, 
  title, 
  duration, 
  createdAt,
  onDelete 
}: VoiceNotePlayerProps) {
  const theme = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const togglePlay = async () => {
    try {
      if (isPlaying && soundRef.current) {
        await soundRef.current.stopAsync();
        setIsPlaying(false);
        setCurrentTime(0);
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      
      soundRef.current = sound;
      setIsPlaying(true);
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setCurrentTime(Math.floor(status.positionMillis / 1000));
          if (status.didJustFinish) {
            setIsPlaying(false);
            setCurrentTime(0);
          }
        }
      });
      
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const styles = createStyles(theme);

  return (
    <View style={styles.playerContainer}>
      <TouchableOpacity style={styles.playButton} onPress={togglePlay}>
        <Ionicons 
          name={isPlaying ? "pause" : "play"} 
          size={24} 
          color={theme.colors.primary} 
        />
      </TouchableOpacity>
      
      <View style={styles.playerInfo}>
        <Text style={styles.playerTitle} numberOfLines={1}>
          {title || 'Voice Note'}
        </Text>
        <Text style={styles.playerMeta}>
          {formatDuration(isPlaying ? currentTime : 0)} / {formatDuration(duration || 0)}
          {createdAt && ` | ${formatDate(createdAt)}`}
        </Text>
      </View>
      
      {onDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
          <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) => StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    alignItems: 'center',
  },
  micContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  micRecording: {
    backgroundColor: theme.colors.error + '20',
  },
  duration: {
    fontSize: 32,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    color: theme.colors.text,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  stopButton: {
    backgroundColor: theme.colors.error,
  },
  disabledButton: {
    opacity: 0.6,
  },
  flex1: {
    flex: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
  },
  buttonTextWhite: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  disabledText: {
    opacity: 0.6,
  },
  playbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: 12,
    width: '100%',
    marginBottom: 16,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playbackInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playbackTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
  },
  playbackDuration: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
  },
  playerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: 12,
  },
  playerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.text,
  },
  playerMeta: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
});
