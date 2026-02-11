import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
  Dimensions,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../src/lib/api';
import { API_URL } from '../../src/lib/api';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, iconSizes } from '../../src/lib/design-tokens';

interface Visualization {
  id: string;
  beforeImageUrl?: string;
  afterImageUrl?: string;
  prompt: string;
  style?: string;
  roomType?: string;
  description?: string;
  jobId?: string;
  jobTitle?: string;
  createdAt: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_WIDTH = SCREEN_WIDTH - spacing.lg * 2;

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getImageUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  contentContainer: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  infoBanner: {
    backgroundColor: colors.infoLight,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoBannerIcon: {
    width: 40, height: 40, borderRadius: radius.lg,
    backgroundColor: colors.info + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  infoBannerText: { flex: 1 },
  infoBannerTitle: { fontSize: 15, fontWeight: '600', color: colors.foreground, marginBottom: spacing.xs },
  infoBannerBody: { fontSize: 13, color: colors.mutedForeground, lineHeight: 18 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.muted,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.foreground, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center', paddingHorizontal: spacing.lg },
  vizCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  imageContainer: {
    flexDirection: 'row',
    height: 180,
  },
  imageHalf: {
    flex: 1,
    position: 'relative' as any,
  },
  vizImage: {
    width: '100%',
    height: '100%',
  },
  imageLabel: {
    position: 'absolute',
    bottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  imageLabelLeft: { left: spacing.xs },
  imageLabelRight: { right: spacing.xs },
  imageLabelText: { fontSize: 11, fontWeight: '600', color: '#ffffff' },
  singleImageContainer: { height: 200 },
  singleImage: { width: '100%', height: '100%' },
  vizContent: { padding: spacing.lg },
  vizPrompt: { fontSize: 14, color: colors.foreground, marginBottom: spacing.sm, lineHeight: 20 },
  vizMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  metaBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: radius.sm, gap: 4,
  },
  metaBadgeText: { fontSize: 12, color: colors.mutedForeground, fontWeight: '500' },
  vizDate: { fontSize: 12, color: colors.mutedForeground },
});

export default function AIVisualizationScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [visualizations, setVisualizations] = useState<Visualization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get<Visualization[]>('/api/ai/visualizations');
      if (res.data) setVisualizations(res.data);
    } catch (error) {
      console.error('Error loading visualizations:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const styleLabels: Record<string, string> = {
    modern: 'Modern', traditional: 'Traditional', industrial: 'Industrial',
    minimalist: 'Minimalist', contemporary: 'Contemporary', rustic: 'Rustic',
  };
  const roomLabels: Record<string, string> = {
    bathroom: 'Bathroom', kitchen: 'Kitchen', living_room: 'Living Room',
    bedroom: 'Bedroom', exterior: 'Exterior', laundry: 'Laundry',
    garage: 'Garage', office: 'Office',
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true, title: 'AI Visualization',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.infoBanner}>
          <View style={styles.infoBannerIcon}>
            <Feather name="info" size={iconSizes.lg} color={colors.info} />
          </View>
          <View style={styles.infoBannerText}>
            <Text style={styles.infoBannerTitle}>AI Image Generation</Text>
            <Text style={styles.infoBannerBody}>
              Full AI visualization generation is available on the web app. This screen shows your previously generated before/after concept images.
            </Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : visualizations.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="image" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>No visualizations yet</Text>
            <Text style={styles.emptyText}>
              Create AI-powered before/after concept images from the web app to help clients envision their renovation.
            </Text>
          </View>
        ) : (
          visualizations.map(viz => (
            <View key={viz.id} style={styles.vizCard}>
              {viz.beforeImageUrl && viz.afterImageUrl ? (
                <View style={styles.imageContainer}>
                  <View style={styles.imageHalf}>
                    <Image source={{ uri: getImageUrl(viz.beforeImageUrl) }} style={styles.vizImage} resizeMode="cover" />
                    <View style={[styles.imageLabel, styles.imageLabelLeft]}>
                      <Text style={styles.imageLabelText}>Before</Text>
                    </View>
                  </View>
                  <View style={styles.imageHalf}>
                    <Image source={{ uri: getImageUrl(viz.afterImageUrl) }} style={styles.vizImage} resizeMode="cover" />
                    <View style={[styles.imageLabel, styles.imageLabelRight]}>
                      <Text style={styles.imageLabelText}>After</Text>
                    </View>
                  </View>
                </View>
              ) : viz.afterImageUrl ? (
                <View style={styles.singleImageContainer}>
                  <Image source={{ uri: getImageUrl(viz.afterImageUrl) }} style={styles.singleImage} resizeMode="cover" />
                </View>
              ) : null}
              <View style={styles.vizContent}>
                <Text style={styles.vizPrompt} numberOfLines={3}>{viz.prompt}</Text>
                <View style={styles.vizMeta}>
                  {viz.style && (
                    <View style={styles.metaBadge}>
                      <Feather name="layers" size={10} color={colors.mutedForeground} />
                      <Text style={styles.metaBadgeText}>{styleLabels[viz.style] || viz.style}</Text>
                    </View>
                  )}
                  {viz.roomType && (
                    <View style={styles.metaBadge}>
                      <Feather name="home" size={10} color={colors.mutedForeground} />
                      <Text style={styles.metaBadgeText}>{roomLabels[viz.roomType] || viz.roomType}</Text>
                    </View>
                  )}
                  {viz.jobTitle && (
                    <View style={styles.metaBadge}>
                      <Feather name="briefcase" size={10} color={colors.mutedForeground} />
                      <Text style={styles.metaBadgeText}>{viz.jobTitle}</Text>
                    </View>
                  )}
                  <View style={styles.metaBadge}>
                    <Feather name="clock" size={10} color={colors.mutedForeground} />
                    <Text style={styles.metaBadgeText}>{formatDate(viz.createdAt)}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
