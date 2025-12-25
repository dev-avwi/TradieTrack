import { View, Text, StyleSheet, ViewStyle, TextStyle, Platform } from 'react-native';
import { ReactNode, useMemo } from 'react';
import { useTheme, ThemeColors, ThemeShadows } from '../../lib/theme';

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
  shadows: ThemeShadows
): ViewStyle {
  switch (variant) {
    case 'elevated':
      return {
        backgroundColor: colors.card,
        borderWidth: 0,
        ...shadows.md,
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
        ...shadows.sm,
      };
  }
}

export function Card({ children, style, variant = 'default' }: CardProps) {
  const { colors, shadows } = useTheme();
  
  const variantStyle = useMemo(
    () => getVariantStyle(variant, colors, shadows), 
    [variant, colors, shadows]
  );

  return (
    <View style={[styles.card, variantStyle, style]}>
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
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: 16,
    paddingBottom: 8,
    gap: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  cardContent: {
    padding: 16,
    paddingTop: 0,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 0,
    gap: 8,
  },
});

export default Card;
