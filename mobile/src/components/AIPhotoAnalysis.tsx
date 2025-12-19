import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../lib/api';
import { useTheme, ThemeColors } from '../lib/theme';
import { spacing, radius, typography } from '../lib/design-tokens';

interface AIPhotoAnalysisProps {
  jobId: string;
  photoCount: number;
  existingNotes?: string;
  onNotesUpdated?: () => void;
  aiEnabled?: boolean;
  aiPhotoAnalysisEnabled?: boolean;
}

export function AIPhotoAnalysis({
  jobId,
  photoCount,
  existingNotes,
  onNotesUpdated,
  aiEnabled = true,
  aiPhotoAnalysisEnabled = true,
}: AIPhotoAnalysisProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [analysisText, setAnalysisText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isAddingToNotes, setIsAddingToNotes] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isAbortedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const startAnalysis = useCallback(async () => {
    if (isAnalysing) return;
    
    setIsAnalysing(true);
    setAnalysisText('');
    setIsComplete(false);
    isAbortedRef.current = false;
    
    abortControllerRef.current = new AbortController();
    
    try {
      const token = await api.getToken();
      const baseUrl = api.getBaseUrl();
      
      const response = await fetch(`${baseUrl}/api/jobs/${jobId}/photos/analyze`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
        },
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to analyse photos');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Streaming not supported on this device');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        if (isAbortedRef.current) break;
        
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                fullText += data.text;
                setAnalysisText(fullText);
              }
              if (data.done) {
                setIsComplete(true);
              }
              if (data.error) {
                throw new Error(data.error);
              }
            } catch (e) {
              if (e instanceof SyntaxError) {
                console.error('SSE parse error:', e);
              } else {
                throw e;
              }
            }
          }
        }
      }
      
      if (!isAbortedRef.current) {
        setIsComplete(true);
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || isAbortedRef.current) {
        return;
      }
      console.error('Photo analysis error:', error);
      Alert.alert(
        'Analysis Failed',
        error.message || 'Could not analyse photos. Please try again.'
      );
      setAnalysisText('');
    } finally {
      if (!isAbortedRef.current) {
        setIsAnalysing(false);
      }
    }
  }, [jobId, isAnalysing]);

  const cancelAnalysis = useCallback(() => {
    isAbortedRef.current = true;
    abortControllerRef.current?.abort();
    setIsAnalysing(false);
    setAnalysisText('');
    setIsComplete(false);
  }, []);

  const addToNotes = useCallback(async () => {
    if (!analysisText.trim()) return;
    
    setIsAddingToNotes(true);
    try {
      const token = await api.getToken();
      const baseUrl = api.getBaseUrl();
      
      const newNotes = existingNotes 
        ? `${existingNotes}\n\n--- AI Photo Analysis ---\n${analysisText}`
        : `--- AI Photo Analysis ---\n${analysisText}`;
      
      const response = await fetch(`${baseUrl}/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: newNotes }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update notes');
      }
      
      Alert.alert('Success', 'Photo analysis added to job notes');
      setAnalysisText('');
      setIsComplete(false);
      onNotesUpdated?.();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not add analysis to notes');
    } finally {
      setIsAddingToNotes(false);
    }
  }, [jobId, analysisText, existingNotes, onNotesUpdated]);

  const discardAnalysis = useCallback(() => {
    setAnalysisText('');
    setIsComplete(false);
  }, []);

  if (photoCount === 0) {
    return null;
  }

  if (!aiEnabled || !aiPhotoAnalysisEnabled) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Feather name="zap" size={16} color={colors.mutedForeground} />
          <Text style={styles.title}>AI Photo Analysis</Text>
          <View style={styles.disabledBadge}>
            <Text style={styles.disabledBadgeText}>Off</Text>
          </View>
        </View>
        <Text style={styles.disabledText}>
          AI photo analysis is disabled. Enable it in Settings to use this feature.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Feather name="zap" size={16} color={colors.primary} />
        <Text style={styles.title}>AI Photo Analysis</Text>
        <View style={styles.betaBadge}>
          <Text style={styles.betaBadgeText}>Beta</Text>
        </View>
        {photoCount > 0 && !isAnalysing && !analysisText && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {photoCount} photo{photoCount !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>

      {!isAnalysing && !analysisText && (
        <View style={styles.content}>
          <Text style={styles.description}>
            Use AI to analyse your job photos and automatically generate notes with photo references.
          </Text>
          <TouchableOpacity
            style={styles.analyseButton}
            onPress={startAnalysis}
            activeOpacity={0.8}
          >
            <Feather name="zap" size={18} color={colors.primaryForeground} />
            <Text style={styles.analyseButtonText}>
              Analyse {photoCount} Photo{photoCount !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isAnalysing && (
        <View style={styles.content}>
          <View style={styles.analysingHeader}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.analysingText}>Analysing photos...</Text>
          </View>
          {analysisText ? (
            <View style={styles.streamingContainer}>
              <ScrollView 
                style={styles.streamingScroll}
                showsVerticalScrollIndicator={true}
              >
                <Text style={styles.streamingText}>
                  {analysisText}
                  <Text style={styles.cursor}>|</Text>
                </Text>
              </ScrollView>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={cancelAnalysis}
            activeOpacity={0.8}
          >
            <Feather name="x" size={16} color={colors.foreground} />
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {isComplete && analysisText && (
        <View style={styles.content}>
          <View style={styles.completeHeader}>
            <Feather name="check-circle" size={16} color={colors.success || '#22c55e'} />
            <Text style={[styles.completeText, { color: colors.success || '#22c55e' }]}>
              Analysis complete
            </Text>
          </View>
          <View style={styles.resultContainer}>
            <ScrollView 
              style={styles.resultScroll}
              showsVerticalScrollIndicator={true}
            >
              <Text style={styles.resultText}>{analysisText}</Text>
            </ScrollView>
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.addButton, isAddingToNotes && styles.buttonDisabled]}
              onPress={addToNotes}
              disabled={isAddingToNotes}
              activeOpacity={0.8}
            >
              {isAddingToNotes ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Feather name="plus" size={16} color={colors.primaryForeground} />
              )}
              <Text style={styles.addButtonText}>Add to Notes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.discardButton, isAddingToNotes && styles.buttonDisabled]}
              onPress={discardAnalysis}
              disabled={isAddingToNotes}
              activeOpacity={0.8}
            >
              <Feather name="x" size={16} color={colors.foreground} />
              <Text style={styles.discardButtonText}>Discard</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.foreground,
  },
  betaBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  betaBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: '500',
    color: colors.primary,
  },
  disabledBadge: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  disabledBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  countBadge: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginLeft: 'auto',
  },
  countBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  content: {
    marginTop: spacing.xs,
  },
  description: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  disabledText: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  analyseButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  analyseButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  analysingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  analysingText: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
  },
  streamingContainer: {
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    maxHeight: 200,
    marginBottom: spacing.md,
  },
  streamingScroll: {
    maxHeight: 180,
  },
  streamingText: {
    fontSize: typography.sizes.sm,
    color: colors.foreground,
    lineHeight: 20,
  },
  cursor: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  cancelButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: '500',
    color: colors.foreground,
  },
  completeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  completeText: {
    fontSize: typography.sizes.sm,
    fontWeight: '500',
  },
  resultContainer: {
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    maxHeight: 200,
    marginBottom: spacing.md,
  },
  resultScroll: {
    maxHeight: 180,
  },
  resultText: {
    fontSize: typography.sizes.sm,
    color: colors.foreground,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  addButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  discardButton: {
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  discardButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: '500',
    color: colors.foreground,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
