import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { api } from '../lib/api';

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
  const { colors, spacing, radius, typography } = useTheme();
  
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    loadVoiceNotes();
  }, [jobId]);

  const loadVoiceNotes = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/api/jobs/${jobId}/voice-notes`);
      setVoiceNotes(response.data || []);
    } catch (error) {
      console.error('Failed to load voice notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const playVoiceNote = async (note: VoiceNote) => {
    try {
      if (note.audioUrl) {
        Linking.openURL(note.audioUrl);
      }
    } catch (error) {
      console.error('Failed to play voice note:', error);
      Alert.alert('Error', 'Failed to play voice note');
    }
  };

  const deleteVoiceNote = async (noteId: string) => {
    Alert.alert(
      'Delete Voice Note',
      'Are you sure you want to delete this voice note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/jobs/${jobId}/voice-notes/${noteId}`);
              setVoiceNotes(prev => prev.filter(n => n.id !== noteId));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete voice note');
            }
          }
        }
      ]
    );
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
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      backgroundColor: `${colors.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      ...typography.subtitle,
      color: colors.foreground,
    },
    countBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.full,
      minWidth: 24,
      alignItems: 'center',
    },
    countText: {
      ...typography.caption,
      color: colors.primaryForeground,
      fontWeight: '600',
    },
    content: {
      padding: spacing.md,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    emptyText: {
      ...typography.body,
      color: colors.mutedForeground,
      marginTop: spacing.sm,
    },
    emptySubtext: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: spacing.xs,
      textAlign: 'center',
      paddingHorizontal: spacing.md,
    },
    noteItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.muted,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    playButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noteInfo: {
      flex: 1,
      marginLeft: spacing.md,
    },
    noteDuration: {
      ...typography.body,
      color: colors.foreground,
      fontWeight: '600',
    },
    noteDate: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    deleteButton: {
      padding: spacing.sm,
    },
    comingSoon: {
      backgroundColor: colors.muted,
      borderRadius: radius.md,
      padding: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    comingSoonText: {
      ...typography.caption,
      color: colors.mutedForeground,
      textAlign: 'center',
    },
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Feather name="mic" size={18} color={colors.primary} />
            </View>
            <Text style={styles.headerTitle}>Voice Notes</Text>
          </View>
        </View>
        <View style={[styles.content, { alignItems: 'center', paddingVertical: spacing.xl }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Feather name="mic" size={18} color={colors.primary} />
          </View>
          <Text style={styles.headerTitle}>Voice Notes</Text>
        </View>
        {voiceNotes.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{voiceNotes.length}</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        {voiceNotes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="mic" size={32} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
            <Text style={styles.emptyText}>No voice notes yet</Text>
            <Text style={styles.emptySubtext}>
              Record hands-free updates on site from the web app
            </Text>
          </View>
        ) : (
          <FlatList
            data={voiceNotes}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.noteItem}>
                <TouchableOpacity
                  style={styles.playButton}
                  onPress={() => playVoiceNote(item)}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={playingId === item.id ? 'pause' : 'play'}
                    size={20}
                    color={colors.primaryForeground}
                  />
                </TouchableOpacity>
                <View style={styles.noteInfo}>
                  <Text style={styles.noteDuration}>{formatDuration(item.duration)}</Text>
                  <Text style={styles.noteDate}>{formatDate(item.createdAt)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteVoiceNote(item.id)}
                  activeOpacity={0.7}
                >
                  <Feather name="trash-2" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}
