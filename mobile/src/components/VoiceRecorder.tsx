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
import { 
  useAudioRecorder, 
  useAudioRecorderState,
  RecordingPresets,
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { useTheme } from '../lib/theme';
import { Ionicons } from '@expo/vector-icons';

interface VoiceRecorderProps {
  onSave: (uri: string, duration: number) => void;
  onCancel?: () => void;
  isUploading?: boolean;
}

export function VoiceRecorder({ onSave, onCancel, isUploading }: VoiceRecorderProps) {
  const theme = useTheme();
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playerError, setPlayerError] = useState<boolean>(false);
  
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 500);
  
  // Create player - expo-audio useAudioPlayer expects (source, updateInterval) 
  // Pass a valid source object or empty string, with 500ms update interval
  const audioSource = recordedUri || '';
  const player = useAudioPlayer(audioSource, 500);
  const playerStatus = useAudioPlayerStatus(player);

  const isRecording = recorderState?.isRecording ?? false;
  const isPlaying = playerStatus?.playing ?? false;
  const currentTime = playerStatus?.currentTime ?? 0;

  useEffect(() => {
    if (recorderState?.durationMillis) {
      setRecordingDuration(Math.floor(recorderState.durationMillis / 1000));
    }
  }, [recorderState?.durationMillis]);

  const requestPermissions = async () => {
    try {
      const { status } = await requestRecordingPermissionsAsync();
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

      // Configure audio mode for iOS recording using setAudioModeAsync from expo-audio
      // This is required on iOS to enable recording mode
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
          interruptionMode: 'doNotMix',
        });
        console.log('[VoiceRecorder] Audio mode configured for iOS recording');
      } catch (audioModeError) {
        console.warn('[VoiceRecorder] Could not set audio mode, proceeding anyway:', audioModeError);
      }

      try {
        await audioRecorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
      } catch (prepareError: any) {
        console.error('Error preparing recorder:', prepareError);
        if (prepareError?.message?.includes('permission') || prepareError?.message?.includes('Permission')) {
          Alert.alert(
            'Microphone Permission Required',
            'Please enable microphone access in your device settings to record voice notes.',
            [{ text: 'OK' }]
          );
          return;
        }
        throw prepareError;
      }

      try {
        audioRecorder.record();
      } catch (recordError: any) {
        console.error('Error starting record:', recordError);
        if (recordError?.message?.includes('permission') || recordError?.message?.includes('Permission')) {
          Alert.alert(
            'Microphone Permission Required',
            'Please enable microphone access in your device settings to record voice notes.',
            [{ text: 'OK' }]
          );
          return;
        }
        throw recordError;
      }
      
    } catch (error: any) {
      console.error('Error starting recording:', error);
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
    try {
      const uri = await audioRecorder.stop();
      
      if (uri) {
        setRecordedUri(uri);
      }
      
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  };

  const pauseRecording = () => {
    try {
      if (recorderState?.isRecording) {
        audioRecorder.pause();
      } else {
        audioRecorder.record();
      }
    } catch (error) {
      console.error('Error pausing recording:', error);
    }
  };

  const playRecording = () => {
    if (!recordedUri || !player) return;

    try {
      if (isPlaying) {
        player.pause();
        return;
      }

      player.seekTo(0);
      player.play();
      
    } catch (error) {
      console.error('Error playing recording:', error);
    }
  };

  const deleteRecording = () => {
    if (player) {
      player.pause();
    }
    setRecordedUri(null);
    setRecordingDuration(0);
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
          
          <Text style={styles.duration}>{formatDuration(recordingDuration)}</Text>
          
          <View style={styles.buttonRow}>
            {!isRecording && !recorderState?.canRecord ? (
              <TouchableOpacity 
                style={[styles.button, styles.primaryButton]}
                onPress={startRecording}
              >
                <Ionicons name="mic" size={20} color="#ffffff" />
                <Text style={styles.buttonTextWhite}>Start Recording</Text>
              </TouchableOpacity>
            ) : isRecording || recorderState?.canRecord ? (
              <>
                <TouchableOpacity 
                  style={[styles.button, styles.outlineButton]}
                  onPress={pauseRecording}
                >
                  <Ionicons 
                    name={isRecording ? "pause" : "play"} 
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
            ) : (
              <TouchableOpacity 
                style={[styles.button, styles.primaryButton]}
                onPress={startRecording}
              >
                <Ionicons name="mic" size={20} color="#ffffff" />
                <Text style={styles.buttonTextWhite}>Start Recording</Text>
              </TouchableOpacity>
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
  // expo-audio useAudioPlayer expects (source, updateInterval)
  const player = useAudioPlayer(uri, 500);
  const status = useAudioPlayerStatus(player);
  
  const isPlaying = status?.playing ?? false;
  const currentTime = status?.currentTime ?? 0;

  const togglePlay = () => {
    if (!player) return;

    try {
      if (isPlaying) {
        player.pause();
        return;
      }

      player.seekTo(0);
      player.play();
      
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
          {formatDuration(Math.floor(isPlaying ? currentTime : 0))} / {formatDuration(duration || 0)}
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
