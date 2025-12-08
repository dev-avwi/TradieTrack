import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../lib/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ 
  width = '100%', 
  height = 20, 
  borderRadius = 8,
  style 
}: SkeletonProps) {
  const { colors } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.muted,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard({ style }: { style?: ViewStyle }) {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      <View style={styles.cardHeader}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={styles.cardHeaderText}>
          <Skeleton width="60%" height={16} />
          <Skeleton width="40%" height={12} style={{ marginTop: 6 }} />
        </View>
      </View>
      <Skeleton width="100%" height={14} style={{ marginTop: 12 }} />
      <Skeleton width="80%" height={14} style={{ marginTop: 6 }} />
    </View>
  );
}

export function SkeletonJobCard({ style }: { style?: ViewStyle }) {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.jobCard, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      <View style={styles.jobCardHeader}>
        <View style={{ flex: 1 }}>
          <Skeleton width="70%" height={18} />
          <Skeleton width="50%" height={14} style={{ marginTop: 8 }} />
        </View>
        <Skeleton width={80} height={24} borderRadius={12} />
      </View>
      <View style={styles.jobCardMeta}>
        <Skeleton width={120} height={14} />
        <Skeleton width={80} height={14} />
      </View>
      <View style={styles.jobCardActions}>
        <Skeleton width="30%" height={36} borderRadius={8} />
        <Skeleton width="30%" height={36} borderRadius={8} />
        <Skeleton width="30%" height={36} borderRadius={8} />
      </View>
    </View>
  );
}

export function SkeletonStatCard({ style }: { style?: ViewStyle }) {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      <Skeleton width={44} height={44} borderRadius={22} />
      <Skeleton width={60} height={28} style={{ marginTop: 12 }} />
      <Skeleton width={80} height={12} style={{ marginTop: 6 }} />
    </View>
  );
}

export function SkeletonListItem({ style }: { style?: ViewStyle }) {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.listItem, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      <Skeleton width={40} height={40} borderRadius={20} />
      <View style={styles.listItemContent}>
        <Skeleton width="60%" height={16} />
        <Skeleton width="40%" height={12} style={{ marginTop: 6 }} />
      </View>
      <Skeleton width={20} height={20} borderRadius={10} />
    </View>
  );
}

export function DashboardSkeleton() {
  return (
    <View style={styles.dashboardContainer}>
      <View style={styles.statsRow}>
        <SkeletonStatCard style={{ flex: 1 }} />
        <SkeletonStatCard style={{ flex: 1 }} />
      </View>
      <View style={styles.statsRow}>
        <SkeletonStatCard style={{ flex: 1 }} />
        <SkeletonStatCard style={{ flex: 1 }} />
      </View>
      <Skeleton width="40%" height={20} style={{ marginTop: 24, marginBottom: 12 }} />
      <SkeletonJobCard />
      <SkeletonJobCard style={{ marginTop: 12 }} />
      <SkeletonJobCard style={{ marginTop: 12 }} />
    </View>
  );
}

export function JobsListSkeleton() {
  return (
    <View style={styles.listContainer}>
      <SkeletonJobCard />
      <SkeletonJobCard style={{ marginTop: 12 }} />
      <SkeletonJobCard style={{ marginTop: 12 }} />
      <SkeletonJobCard style={{ marginTop: 12 }} />
    </View>
  );
}

export function ClientsListSkeleton() {
  return (
    <View style={styles.listContainer}>
      <SkeletonListItem />
      <SkeletonListItem style={{ marginTop: 8 }} />
      <SkeletonListItem style={{ marginTop: 8 }} />
      <SkeletonListItem style={{ marginTop: 8 }} />
      <SkeletonListItem style={{ marginTop: 8 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  jobCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  jobCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  jobCardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  jobCardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  statCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  listItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  dashboardContainer: {
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  listContainer: {
    padding: 16,
  },
});
