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
import { useTheme } from '../lib/theme';
import { Ionicons } from '@expo/vector-icons';

let Audio: any = null;
let isAudioAvailable = false;

try {
  const expoAv = require('expo-av');
  Audio = expoAv.Audio;
  isAudioAvailable = true;
} catch (e) {
  console.warn('[VoiceRecorder] expo-av not available - voice recording disabled');
  isAudioAvailable = false;
}

interface VoiceRecorderProps {
  onSave: (uri: string, duration: number) => void;
  onCancel?: () => void;
  isUploading?: boolean;
}

export function VoiceRecorder({ onSave, onCancel, isUploading }: VoiceRecorderProps) {
  const theme = useTheme();
  const [recording, setRecording] = useState<any>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sound, setSound] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  
  const recordingRef = useRef<any>(null);
  const soundRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      if (soundRef.current && isAudioAvailable) {
        soundRef.current.unloadAsync().catch((e: any) => 
          console.warn('[VoiceRecorder] Error unloading sound on cleanup:', e)
        );
      }
      if (recordingRef.current && isAudioAvailable) {
        recordingRef.current.stopAndUnloadAsync().catch((e: any) =>
          console.warn('[VoiceRecorder] Error stopping recording on cleanup:', e)
        );
      }
      if (isAudioAvailable && Audio) {
        Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        }).catch((e: any) => console.warn('[VoiceRecorder] Error resetting audio mode on cleanup:', e));
      }
    };
  }, []);

  const styles = createStyles(theme);

  if (!isAudioAvailable || !Audio) {
    return (
      <View style={styles.container}>
        <View style={styles.unavailableContainer}>
          <Ionicons name="mic-off-outline" size={48} color={theme.colors.mutedForeground} />
          <Text style={styles.unavailableTitle}>Voice Recording Unavailable</Text>
          <Text style={styles.unavailableText}>
            Voice recording requires a development build. It's not available in Expo Go.
          </Text>
          {onCancel && (
            <TouchableOpacity 
              style={[styles.button, styles.outlineButton, { marginTop: 16 }]}
              onPress={onCancel}
            >
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const requestPermissions = async () => {
    try {
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
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert(
        'Permission Error',
        'Could not check microphone permissions. Please try again.',
        [{ text: 'OK' }]
      );
      return false;
    }
  };

  const startRecording = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      console.log('[VoiceRecorder] Audio mode configured with allowsRecordingIOS: true');

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      recordingRef.current = newRecording;
      setIsRecording(true);
      setIsPaused(false);
      setRecordingDuration(0);

      durationInterval.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      console.log('[VoiceRecorder] Recording started successfully');
      
    } catch (error: any) {
      console.error('Error starting recording:', error);
      
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
      } catch (resetError) {
        console.warn('Could not reset audio mode:', resetError);
      }
      
      if (error?.message?.includes('permission') || error?.message?.includes('Permission')) {
        Alert.alert(
          'Microphone Permission Required',
          'Please enable microphone access in your device settings to record voice notes.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Could not start recording. Please try again.');
      }
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }

      await recording.stopAndUnloadAsync();
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const uri = recording.getURI();
      console.log('[VoiceRecorder] Recording stopped, URI:', uri);
      
      if (uri) {
        setRecordedUri(uri);
      }
      
      setRecording(null);
      recordingRef.current = null;
      setIsRecording(false);
      setIsPaused(false);
      
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  };

  const pauseRecording = async () => {
    if (!recording) return;

    try {
      if (isPaused) {
        await recording.startAsync();
        setIsPaused(false);
        durationInterval.current = setInterval(() => {
          setRecordingDuration(prev => prev + 1);
        }, 1000);
      } else {
        await recording.pauseAsync();
        setIsPaused(true);
        if (durationInterval.current) {
          clearInterval(durationInterval.current);
          durationInterval.current = null;
        }
      }
    } catch (error) {
      console.error('Error pausing recording:', error);
    }
  };

  const playRecording = async () => {
    if (!recordedUri) return;

    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
          return;
        } else {
          await sound.setPositionAsync(0);
          await sound.playAsync();
          setIsPlaying(true);
          return;
        }
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: recordedUri },
        { shouldPlay: true }
      );
      
      setSound(newSound);
      soundRef.current = newSound;
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
      
    } catch (error) {
      console.error('Error playing recording:', error);
    }
  };

  const deleteRecording = async () => {
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
      soundRef.current = null;
    }
    setRecordedUri(null);
    setRecordingDuration(0);
    setIsPlaying(false);
  };

  const handleSave = () => {
    if (recordedUri) {
      onSave(recordedUri, recordingDuration);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {!recordedUri ? (
        <>
          <View style={[styles.micContainer, isRecording && styles.micRecording]}>
            <Ionicons 
              name="mic" 
              size={32} 
              color={isRecording ? theme.colors.destructive : theme.colors.primary} 
            />
          </View>
          
          <Text style={styles.duration}>{formatDuration(recordingDuration)}</Text>
          
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
              <Text style={styles.playbackDuration}>{formatDuration(recordingDuration)}</Text>
            </View>
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={deleteRecording}
            >
              <Ionicons name="trash-outline" size={20} color={theme.colors.destructive} />
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
  fallbackUri?: string;
  title?: string;
  duration?: number;
  createdAt?: string;
  onDelete?: () => void;
}

export function VoiceNotePlayer({ 
  uri, 
  fallbackUri,
  title, 
  duration, 
  createdAt,
  onDelete 
}: VoiceNotePlayerProps) {
  const theme = useTheme();
  const soundRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  // Cleanup helper function
  const cleanupSound = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {
        // Ignore cleanup errors
      }
      soundRef.current = null;
    }
    setIsLoaded(false);
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const loadAndPlayAudio = async (audioUri: string): Promise<boolean> => {
    try {
      console.log('[VoiceNotePlayer] Attempting to load:', audioUri);
      
      // Always clean up before loading new audio
      await cleanupSound();
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      );
      
      soundRef.current = newSound;
      setIsLoaded(true);
      setIsPlaying(true);
      setHasError(false);

      newSound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded) {
          setCurrentTime(Math.floor((status.positionMillis || 0) / 1000));
          if (status.didJustFinish) {
            setIsPlaying(false);
            setCurrentTime(0);
          }
        }
        if (status.error) {
          console.error('[VoiceNotePlayer] Playback error:', status.error);
          setHasError(true);
          setIsPlaying(false);
        }
      });
      
      return true;
    } catch (error) {
      console.error('[VoiceNotePlayer] Error loading audio:', error);
      return false;
    }
  };

  const togglePlay = async () => {
    if (!isAudioAvailable || !Audio) {
      Alert.alert('Unavailable', 'Audio playback requires a development build.');
      return;
    }

    try {
      // If sound is loaded and not in error state, just toggle play/pause
      if (soundRef.current && isLoaded && !hasError) {
        if (isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
          return;
        } else {
          await soundRef.current.setPositionAsync(0);
          await soundRef.current.playAsync();
          setIsPlaying(true);
          return;
        }
      }

      // If there was an error, reset and try again
      if (hasError) {
        await cleanupSound();
        setHasError(false);
      }

      setIsLoading(true);
      
      // Try primary URL first
      if (uri && uri.length > 0) {
        const success = await loadAndPlayAudio(uri);
        if (success) {
          setIsLoading(false);
          return;
        }
      }
      
      // Try fallback URL if primary fails
      if (fallbackUri && fallbackUri.length > 0) {
        console.log('[VoiceNotePlayer] Primary URL failed, trying fallback:', fallbackUri);
        const success = await loadAndPlayAudio(fallbackUri);
        if (success) {
          setIsLoading(false);
          return;
        }
      }
      
      // Both failed
      setIsLoading(false);
      setHasError(true);
      Alert.alert('Playback Error', 'Unable to play this voice note. Please try again later.');
      
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsLoading(false);
      setHasError(true);
      Alert.alert('Error', 'Failed to play voice note.');
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
    <View style={[styles.playerContainer, hasError && styles.playerContainerError]}>
      <TouchableOpacity 
        style={[styles.playButton, isLoading && styles.playButtonDisabled]} 
        onPress={togglePlay}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <Ionicons 
            name={hasError ? "reload" : (isPlaying ? "pause" : "play")} 
            size={24} 
            color={hasError ? theme.colors.mutedForeground : theme.colors.primary} 
          />
        )}
      </TouchableOpacity>
      
      <View style={styles.playerInfo}>
        <Text style={[styles.playerTitle, hasError && styles.playerTitleError]} numberOfLines={1}>
          {title || 'Voice Note'}
        </Text>
        <Text style={styles.playerMeta}>
          {hasError ? 'Tap to retry' : (
            `${formatDuration(isPlaying ? currentTime : 0)} / ${formatDuration(duration || 0)}${createdAt ? ` | ${formatDate(createdAt)}` : ''}`
          )}
        </Text>
      </View>
      
      {onDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
          <Ionicons name="trash-outline" size={20} color={theme.colors.destructive} />
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
  unavailableContainer: {
    alignItems: 'center',
    padding: 20,
  },
  unavailableTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.foreground,
    marginTop: 12,
    marginBottom: 8,
  },
  unavailableText: {
    fontSize: 14,
    color: theme.colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
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
    backgroundColor: theme.colors.destructive + '20',
  },
  duration: {
    fontSize: 32,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    color: theme.colors.foreground,
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
    backgroundColor: theme.colors.destructive,
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
    color: theme.colors.foreground,
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
    color: theme.colors.foreground,
  },
  playbackDuration: {
    fontSize: 14,
    color: theme.colors.mutedForeground,
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
  playerContainerError: {
    opacity: 0.7,
  },
  playButtonDisabled: {
    opacity: 0.5,
  },
  playerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.foreground,
  },
  playerTitleError: {
    color: theme.colors.mutedForeground,
  },
  playerMeta: {
    fontSize: 13,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
});
