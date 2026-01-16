import { View, Text, StyleSheet, ViewStyle, TextStyle, Platform } from 'react-native';
import { ReactNode, useMemo } from 'react';
import { useTheme, ThemeColors, ThemeShadows } from '../../lib/theme';
import { isIOS, getIOSCardStyle, IOSCorners } from '../../lib/ios-design';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'outlined' | 'ghost';
}

interface CardHeaderProps {
  children: ReactNode;
  style?: ViewStyle;
}

interface CardTitleProps {
  children: ReactNode;
  style?: TextStyle;
}

interface CardDescriptionProps {
  children: ReactNode;
  style?: TextStyle;
}

interface CardContentProps {
  children: ReactNode;
  style?: ViewStyle;
}

interface CardFooterProps {
  children: ReactNode;
  style?: ViewStyle;
}

function getVariantStyle(
  variant: string, 
  colors: ThemeColors, 
  shadows: ThemeShadows,
  isDark: boolean
): ViewStyle {
  if (isIOS) {
    const iosStyles = getIOSCardStyle(isDark);
    
    switch (variant) {
      case 'elevated':
        return iosStyles.elevated;
      case 'outlined':
        return iosStyles.outlined;
      case 'ghost':
        return iosStyles.ghost;
      default:
        return iosStyles.container;
    }
  }
  
  switch (variant) {
    case 'elevated':
      return {
        backgroundColor: colors.card,
        borderWidth: 0,
        ...(Platform.OS === 'android' 
          ? { elevation: shadows.md.elevation }
          : shadows.md
        ),
      };
    case 'outlined':
      return {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.cardBorder,
      };
    case 'ghost':
      return {
        backgroundColor: 'transparent',
        borderWidth: 0,
      };
    default:
      return {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        ...(Platform.OS === 'android' 
          ? { elevation: shadows.sm.elevation }
          : shadows.sm
        ),
      };
  }
}

export function Card({ children, style, variant = 'default' }: CardProps) {
  const { colors, shadows, isDark } = useTheme();
  
  const variantStyle = useMemo(
    () => getVariantStyle(variant, colors, shadows, isDark), 
    [variant, colors, shadows, isDark]
  );

  const borderRadius = isIOS ? IOSCorners.card : 14;

  return (
    <View style={[styles.card, { borderRadius }, variantStyle, style]}>
      {children}
    </View>
  );
}

export function CardHeader({ children, style }: CardHeaderProps) {
  return (
    <View style={[styles.cardHeader, style]}>
      {children}
    </View>
  );
}

export function CardTitle({ children, style }: CardTitleProps) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.cardTitle, { color: colors.foreground }, style]}>
      {children}
    </Text>
  );
}

export function CardDescription({ children, style }: CardDescriptionProps) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.cardDescription, { color: colors.mutedForeground }, style]}>
      {children}
    </Text>
  );
}

export function CardContent({ children, style }: CardContentProps) {
  return (
    <View style={[styles.cardContent, style]}>
      {children}
    </View>
  );
}

export function CardFooter({ children, style }: CardFooterProps) {
  return (
    <View style={[styles.cardFooter, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
  },
  cardHeader: {
    padding: 20,
    paddingBottom: 8,
    gap: 4,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  cardContent: {
    padding: 20,
    paddingTop: 0,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 0,
    gap: 8,
  },
});

export default Card;
