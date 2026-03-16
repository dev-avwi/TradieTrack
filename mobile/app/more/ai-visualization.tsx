import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { spacing, radius, typography, iconSizes } from '../../src/lib/design-tokens';

interface Visualization {
  id: string;
  beforeImageUrl: string;
  afterImageUrl: string;
  prompt: string;
  style: string;
  roomType: string;
  description: string;
  jobId?: string;
  jobTitle?: string;
  createdAt: string;
}

const STYLE_LABELS: Record<string, string> = {
  modern: 'Modern',
  traditional: 'Traditional',
  industrial: 'Industrial',
  minimalist: 'Minimalist',
  contemporary: 'Contemporary',
  rustic: 'Rustic',
};

const ROOM_LABELS: Record<string, string> = {
  bathroom: 'Bathroom',
  kitchen: 'Kitchen',
  living_room: 'Living Room',
  bedroom: 'Bedroom',
  exterior: 'Exterior',
  laundry: 'Laundry',
  garage: 'Garage',
  office: 'Office',
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AIVisualizationScreen() {
  const { colors } = useTheme();

  const params = useLocalSearchParams();
  const jobId = params.jobId as string | undefined;
  const [visualizations, setVisualizations] = useState<Visualization[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedViz, setSelectedViz] = useState<Visualization | null>(null);
  const [job, setJob] = useState<{ id: string; title: string } | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const url = jobId ? `/api/ai/visualizations?jobId=${jobId}` : '/api/ai/visualizations';
      const res = await api.get<Visualization[]>(url);
      if (res.data) setVisualizations(res.data);
      if (jobId) {
        const jobRes = await api.get<{ id: string; title: string }>(`/api/jobs/${jobId}`);
        if (jobRes.data) setJob(jobRes.data);
      }
    } catch (e) {
      setError('Failed to load visualizations. Pull down to retry.');
      console.error('Error fetching visualizations:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [jobId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const styles = createStyles(colors);
  const imageWidth = (SCREEN_WIDTH - spacing.md * 2 - spacing.sm) / 2;

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading visualizations...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={iconSizes.md} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>AI Visualization</Text>
            <Text style={styles.headerSubtitle}>Before & after concept images</Text>
          </View>
        </View>
      </View>

      {job && (
        <View style={styles.jobBanner}>
          <Feather name="briefcase" size={16} color={colors.mutedForeground} />
          <View>
            <Text style={styles.jobBannerLabel}>Visualizing for job:</Text>
            <Text style={styles.jobBannerTitle}>{job.title}</Text>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {error ? (
          <View style={styles.emptyState}>
            <Feather name="alert-circle" size={48} color={colors.destructive} />
            <Text style={styles.emptyTitle}>Something went wrong</Text>
            <Text style={styles.emptySubtitle}>{error}</Text>
            <TouchableOpacity style={[styles.emptyButton, { backgroundColor: colors.primary }]} onPress={() => { setLoading(true); fetchData(); }}>
              <Feather name="refresh-cw" size={14} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : visualizations.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="image" size={48} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>No Visualizations Yet</Text>
            <Text style={styles.emptySubtitle}>
              AI-generated before/after concept images will appear here. Create them from the web app to help clients envision their renovation.
            </Text>
          </View>
        ) : (
          visualizations.map(viz => (
            <TouchableOpacity
              key={viz.id}
              style={styles.card}
              onPress={() => setSelectedViz(selectedViz?.id === viz.id ? null : viz)}
              activeOpacity={0.7}
            >
              <View style={styles.imageRow}>
                <View style={styles.imageContainer}>
                  <Image source={{ uri: viz.beforeImageUrl }} style={[styles.image, { width: imageWidth - spacing.md }]} resizeMode="cover" />
                  <View style={[styles.imageBadge, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.imageBadgeText, { color: colors.mutedForeground }]}>Before</Text>
                  </View>
                </View>
                <View style={styles.imageContainer}>
                  <Image source={{ uri: viz.afterImageUrl }} style={[styles.image, { width: imageWidth - spacing.md }]} resizeMode="cover" />
                  <View style={[styles.imageBadge, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.imageBadgeText, { color: colors.primary }]}>After</Text>
                  </View>
                </View>
              </View>

              <View style={styles.vizInfo}>
                <Text style={styles.vizPrompt} numberOfLines={selectedViz?.id === viz.id ? undefined : 2}>{viz.prompt}</Text>
                <View style={styles.vizBadges}>
                  <View style={[styles.vizBadge, { backgroundColor: colors.muted }]}>
                    <Text style={styles.vizBadgeText}>{STYLE_LABELS[viz.style] || viz.style}</Text>
                  </View>
                  <View style={[styles.vizBadge, { backgroundColor: colors.muted }]}>
                    <Text style={styles.vizBadgeText}>{ROOM_LABELS[viz.roomType] || viz.roomType}</Text>
                  </View>
                </View>
                <View style={styles.vizMeta}>
                  <Feather name="clock" size={12} color={colors.mutedForeground} />
                  <Text style={styles.vizMetaText}>{formatDate(viz.createdAt)}</Text>
                </View>
                {viz.jobTitle && (
                  <TouchableOpacity
                    style={styles.vizJobLink}
                    onPress={() => router.push(`/job/${viz.jobId}` as any)}
                  >
                    <Feather name="briefcase" size={12} color={colors.primary} />
                    <Text style={[styles.vizMetaText, { color: colors.primary }]}>{viz.jobTitle}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {selectedViz?.id === viz.id && viz.description && (
                <View style={styles.vizDescription}>
                  <Text style={styles.vizDescriptionText}>{viz.description}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backButton: { padding: spacing.xs },
  headerTitle: { ...typography.subtitle, color: colors.foreground },
  headerSubtitle: { ...typography.caption, color: colors.mutedForeground },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loadingText: { ...typography.body, color: colors.mutedForeground },
  jobBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  jobBannerLabel: { ...typography.caption, color: colors.mutedForeground },
  jobBannerTitle: { ...typography.label, color: colors.foreground },
  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2, gap: spacing.sm },
  emptyTitle: { ...typography.subtitle, color: colors.foreground },
  emptySubtitle: { ...typography.body, color: colors.mutedForeground, textAlign: 'center', paddingHorizontal: spacing.lg },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, marginTop: spacing.sm },
  emptyButtonText: { ...typography.label, color: '#FFFFFF' },
  card: { backgroundColor: colors.card, borderRadius: radius.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  imageRow: { flexDirection: 'row', gap: spacing.xs },
  imageContainer: { flex: 1, position: 'relative' },
  image: { width: '100%', height: 120, backgroundColor: colors.muted },
  imageBadge: { position: 'absolute', bottom: spacing.xs, left: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  imageBadgeText: { ...typography.caption, fontWeight: '600', fontSize: 10 },
  vizInfo: { padding: spacing.md, gap: spacing.xs },
  vizPrompt: { ...typography.body, color: colors.foreground },
  vizBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  vizBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  vizBadgeText: { ...typography.caption, color: colors.mutedForeground },
  vizMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  vizMetaText: { ...typography.caption, color: colors.mutedForeground },
  vizJobLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  vizDescription: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  vizDescriptionText: { ...typography.body, color: colors.mutedForeground },
});
