/**
 * iOS 26 Liquid Glass Chip/Filter
 * 
 * A chip or filter button with glass material for filter bars
 * and tag-style selections.
 */
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../lib/theme';
import { isIOS } from '../../lib/device';
import { LiquidGlass, IOSSystemColors, IOSTypography } from '../../lib/ios-design';

interface GlassChipProps {
  /** Chip label */
  label: string;
  /** Whether the chip is selected */
  selected?: boolean;
  /** Press handler */
  onPress: () => void;
  /** Left icon name */
  icon?: string;
  /** Show close button (for removable chips) */
  onRemove?: () => void;
  /** Custom style */
  style?: ViewStyle;
  /** Size variant */
  size?: 'small' | 'medium';
  /** Count badge */
  count?: number;
}

export function GlassChip({
  label,
  selected = false,
  onPress,
  icon,
  onRemove,
  style,
  size = 'medium',
  count,
}: GlassChipProps) {
  const { isDark } = useTheme();
  
  const iosColors = isDark ? IOSSystemColors.dark : IOSSystemColors.light;
  
  // Selected state colors
  const selectedBackground = IOSSystemColors.systemBlue;
  const selectedTextColor = '#fff';
  
  // Unselected glass background
  const glassBackground = isDark
    ? 'rgba(255, 255, 255, 0.08)'
    : 'rgba(255, 255, 255, 0.6)';
  
  const handlePress = () => {
    if (isIOS) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };
  
  const handleRemove = () => {
    if (onRemove) {
      if (isIOS) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onRemove();
    }
  };
  
  const isSmall = size === 'small';
  const textColor = selected ? selectedTextColor : iosColors.label;
  const iconColor = selected ? selectedTextColor : iosColors.secondaryLabel;
  
  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        isSmall && styles.containerSmall,
        pressed && styles.pressed,
        style,
      ]}
    >
      {/* Background */}
      {selected ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.selectedBackground,
            { backgroundColor: selectedBackground },
          ]}
        />
      ) : isIOS ? (
        <>
          <BlurView
            intensity={20}
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
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.border,
              {
                borderColor: isDark 
                  ? 'rgba(255, 255, 255, 0.12)' 
                  : 'rgba(0, 0, 0, 0.06)',
              },
            ]}
          />
        </>
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.solidBackground,
            { backgroundColor: iosColors.tertiarySystemFill },
          ]}
        />
      )}
      
      {/* Content */}
      <View style={styles.content}>
        {icon && (
          <Feather 
            name={icon as any} 
            size={isSmall ? 12 : 14} 
            color={iconColor} 
            style={styles.icon}
          />
        )}
        <Text 
          style={[
            isSmall ? styles.labelSmall : styles.label, 
            { color: textColor },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {count !== undefined && (
          <Text 
            style={[
              styles.count, 
              { color: selected ? 'rgba(255,255,255,0.8)' : iosColors.secondaryLabel },
            ]}
          >
            {count}
          </Text>
        )}
        {onRemove && (
          <Pressable onPress={handleRemove} style={styles.removeButton}>
            <Feather 
              name="x" 
              size={14} 
              color={selected ? selectedTextColor : iosColors.tertiaryLabel} 
            />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    marginRight: 8,
    marginBottom: 8,
  },
  containerSmall: {
    height: 28,
    borderRadius: 14,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  blurLayer: {
    borderRadius: 17,
    overflow: 'hidden',
  },
  glassOverlay: {
    borderRadius: 17,
  },
  selectedBackground: {
    borderRadius: 17,
  },
  solidBackground: {
    borderRadius: 17,
  },
  border: {
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  icon: {
    marginRight: 6,
  },
  label: {
    ...IOSTypography.subhead,
    fontWeight: '500',
  },
  labelSmall: {
    ...IOSTypography.footnote,
    fontWeight: '500',
  },
  count: {
    ...IOSTypography.footnote,
    marginLeft: 6,
  },
  removeButton: {
    marginLeft: 4,
    padding: 2,
  },
});

export default GlassChip;
