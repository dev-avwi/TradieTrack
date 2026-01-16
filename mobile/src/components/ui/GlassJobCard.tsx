/**
 * iOS 26 Liquid Glass Job Card
 * 
 * A job card with glass material for job lists. Shows job details
 * with status indicator and supports press actions.
 */
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../lib/theme';
import { isIOS } from '../../lib/device';
import { LiquidGlass, IOSSystemColors, IOSTypography, IOSCorners } from '../../lib/ios-design';

type JobStatus = 'pending' | 'confirmed' | 'in-progress' | 'done' | 'invoiced';

interface GlassJobCardProps {
  /** Job title */
  title: string;
  /** Client name */
  client: string;
  /** Job status */
  status: JobStatus;
  /** Scheduled time */
  scheduledTime?: string;
  /** Address */
  address?: string;
  /** Price/amount */
  amount?: string;
  /** Press handler */
  onPress: () => void;
  /** Custom style */
  style?: ViewStyle;
  /** Whether this is the first item (for rounded corners) */
  isFirst?: boolean;
  /** Whether this is the last item (for rounded corners) */
  isLast?: boolean;
}

// Status colors and labels
const statusConfig: Record<JobStatus, { color: string; label: string; icon: string }> = {
  'pending': { color: IOSSystemColors.systemOrange, label: 'Pending', icon: 'clock' },
  'confirmed': { color: IOSSystemColors.systemBlue, label: 'Confirmed', icon: 'check-circle' },
  'in-progress': { color: IOSSystemColors.systemGreen, label: 'In Progress', icon: 'play-circle' },
  'done': { color: IOSSystemColors.systemPurple, label: 'Done', icon: 'check' },
  'invoiced': { color: IOSSystemColors.systemTeal, label: 'Invoiced', icon: 'file-text' },
};

export function GlassJobCard({
  title,
  client,
  status,
  scheduledTime,
  address,
  amount,
  onPress,
  style,
  isFirst = false,
  isLast = false,
}: GlassJobCardProps) {
  const { isDark } = useTheme();
  
  const iosColors = isDark ? IOSSystemColors.dark : IOSSystemColors.light;
  const statusInfo = statusConfig[status] || statusConfig.pending;
  
  // Glass background
  const glassBackground = isDark
    ? 'rgba(255, 255, 255, 0.04)'
    : 'rgba(255, 255, 255, 0.5)';
  
  const handlePress = () => {
    if (isIOS) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };
  
  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        isFirst && styles.firstItem,
        isLast && styles.lastItem,
        pressed && styles.pressed,
        style,
      ]}
    >
      {/* Glass background */}
      {isIOS ? (
        <>
          <BlurView
            intensity={18}
            tint={isDark ? 'dark' : 'light'}
            style={[StyleSheet.absoluteFill, styles.blurLayer]}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.glassOverlay,
              { backgroundColor: glassBackground },
            ]}
          />
          {/* Border */}
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.border,
              {
                borderColor: isDark 
                  ? 'rgba(255, 255, 255, 0.06)' 
                  : 'rgba(255, 255, 255, 0.6)',
              },
            ]}
          />
        </>
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.solidBackground,
            { backgroundColor: iosColors.secondarySystemGroupedBackground },
          ]}
        />
      )}
      
      {/* Status indicator bar */}
      <View style={[styles.statusBar, { backgroundColor: statusInfo.color }]} />
      
      {/* Content */}
      <View style={styles.content}>
        {/* Header row */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text 
              style={[styles.title, { color: iosColors.label }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text 
              style={[styles.client, { color: iosColors.secondaryLabel }]}
              numberOfLines={1}
            >
              {client}
            </Text>
          </View>
          
          {/* Status badge */}
          <View style={[styles.statusBadge, { backgroundColor: `${statusInfo.color}15` }]}>
            <Feather name={statusInfo.icon as any} size={12} color={statusInfo.color} />
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>
        
        {/* Details row */}
        <View style={styles.details}>
          {scheduledTime && (
            <View style={styles.detailItem}>
              <Feather name="clock" size={12} color={iosColors.tertiaryLabel} />
              <Text style={[styles.detailText, { color: iosColors.secondaryLabel }]}>
                {scheduledTime}
              </Text>
            </View>
          )}
          {address && (
            <View style={[styles.detailItem, styles.detailItemFlex]}>
              <Feather name="map-pin" size={12} color={iosColors.tertiaryLabel} />
              <Text 
                style={[styles.detailText, { color: iosColors.secondaryLabel }]}
                numberOfLines={1}
              >
                {address}
              </Text>
            </View>
          )}
        </View>
        
        {/* Amount */}
        {amount && (
          <View style={styles.amountRow}>
            <Text style={[styles.amount, { color: iosColors.label }]}>
              {amount}
            </Text>
            <Feather name="chevron-right" size={18} color={iosColors.tertiaryLabel} />
          </View>
        )}
      </View>
      
      {/* Separator */}
      {!isLast && (
        <View 
          style={[
            styles.separator, 
            { backgroundColor: iosColors.separator },
          ]} 
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  firstItem: {
    borderTopLeftRadius: LiquidGlass.corners.small,
    borderTopRightRadius: LiquidGlass.corners.small,
  },
  lastItem: {
    borderBottomLeftRadius: LiquidGlass.corners.small,
    borderBottomRightRadius: LiquidGlass.corners.small,
  },
  pressed: {
    opacity: 0.9,
  },
  blurLayer: {
    overflow: 'hidden',
  },
  glassOverlay: {},
  solidBackground: {},
  border: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  content: {
    padding: 14,
    paddingLeft: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    ...IOSTypography.headline,
  },
  client: {
    ...IOSTypography.subhead,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusText: {
    ...IOSTypography.caption1,
    fontWeight: '600',
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailItemFlex: {
    flex: 1,
  },
  detailText: {
    ...IOSTypography.footnote,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  amount: {
    ...IOSTypography.headline,
  },
  separator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
});

export default GlassJobCard;
