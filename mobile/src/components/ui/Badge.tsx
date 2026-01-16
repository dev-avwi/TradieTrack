import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { ReactNode, useMemo } from 'react';
import { useTheme, ThemeColors } from '../../lib/theme';
import { isIOS, getIOSBadgeStyle, IOSCorners } from '../../lib/ios-design';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

function getVariantStyles(variant: BadgeVariant, colors: ThemeColors, isDark: boolean) {
  if (isIOS) {
    const iosVariant = variant === 'outline' ? 'secondary' 
      : variant === 'info' ? 'default'
      : variant as 'default' | 'success' | 'warning' | 'destructive' | 'secondary';
    
    const iosStyles = getIOSBadgeStyle(iosVariant, isDark);
    return {
      backgroundColor: iosStyles.container.backgroundColor,
      borderColor: 'transparent',
      textColor: iosStyles.text.color,
      borderRadius: IOSCorners.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 0,
    };
  }
  
  switch (variant) {
    case 'default':
      return {
        backgroundColor: colors.primaryLight,
        borderColor: 'transparent',
        textColor: colors.primary,
      };
    case 'secondary':
      return {
        backgroundColor: colors.cardHover,
        borderColor: 'transparent',
        textColor: colors.foreground,
      };
    case 'destructive':
      return {
        backgroundColor: colors.destructiveLight,
        borderColor: 'transparent',
        textColor: colors.destructive,
      };
    case 'outline':
      return {
        backgroundColor: 'transparent',
        borderColor: colors.border,
        textColor: colors.foreground,
      };
    case 'success':
      return {
        backgroundColor: colors.successLight,
        borderColor: 'transparent',
        textColor: colors.success,
      };
    case 'warning':
      return {
        backgroundColor: colors.warningLight,
        borderColor: 'transparent',
        textColor: colors.warning,
      };
    case 'info':
      return {
        backgroundColor: colors.infoLight,
        borderColor: 'transparent',
        textColor: colors.primary,
      };
    default:
      return {
        backgroundColor: colors.primaryLight,
        borderColor: 'transparent',
        textColor: colors.primary,
      };
  }
}

export function Badge({ children, variant = 'default', style, textStyle }: BadgeProps) {
  const { colors, isDark } = useTheme();
  
  const variantStyles = useMemo(() => getVariantStyles(variant, colors, isDark), [variant, colors, isDark]);

  const badgeStyle: ViewStyle = isIOS ? {
    borderRadius: variantStyles.borderRadius || IOSCorners.pill,
    paddingHorizontal: variantStyles.paddingHorizontal || 8,
    paddingVertical: variantStyles.paddingVertical || 3,
    borderWidth: variantStyles.borderWidth || 0,
  } : styles.badge;

  return (
    <View
      style={[
        badgeStyle,
        {
          backgroundColor: variantStyles.backgroundColor,
          borderColor: variantStyles.borderColor,
          flexDirection: 'row',
          alignItems: 'center',
        },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text style={[
          isIOS ? styles.iosText : styles.text, 
          { color: variantStyles.textColor }, 
          textStyle
        ]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  text: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  iosText: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0,
  },
});

export default Badge;
