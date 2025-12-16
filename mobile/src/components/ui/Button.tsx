import { Pressable, Text, ActivityIndicator, View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { ReactNode } from 'react';
import { useTheme } from '../../lib/theme';

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'brand';
type ButtonSize = 'default' | 'sm' | 'lg' | 'xl' | 'icon';

// Brand button colors - fixed blue for guaranteed visibility
const BRAND_COLORS = {
  background: '#2563EB',
  backgroundPressed: '#1D4ED8',
  border: '#1D4ED8',
  text: '#FFFFFF',
};

interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  children,
  variant = 'default',
  size = 'default',
  onPress,
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  style,
}: ButtonProps) {
  const { colors, isDark } = useTheme();

  const getVariantStyles = (pressed: boolean) => {
    const elevateColor = pressed 
      ? (isDark ? colors.elevate2 : colors.elevate2)
      : 'transparent';
    
    switch (variant) {
      case 'default':
        return {
          backgroundColor: colors.primary,
          borderColor: isDark 
            ? `rgba(238, 242, 245, 0.15)` 
            : `rgba(31, 39, 51, 0.15)`,
          textColor: colors.primaryForeground,
          overlayColor: elevateColor,
        };
      case 'destructive':
        return {
          backgroundColor: colors.destructive,
          borderColor: colors.destructiveDark,
          textColor: colors.destructiveForeground,
          overlayColor: elevateColor,
        };
      case 'outline':
        return {
          backgroundColor: pressed ? colors.elevate1 : 'transparent',
          borderColor: colors.buttonOutline,
          textColor: colors.foreground,
          overlayColor: 'transparent',
        };
      case 'secondary':
        return {
          backgroundColor: colors.secondary,
          borderColor: isDark 
            ? `rgba(37, 42, 50, 0.15)` 
            : `rgba(227, 227, 227, 0.15)`,
          textColor: colors.secondaryForeground,
          overlayColor: elevateColor,
        };
      case 'ghost':
        return {
          backgroundColor: pressed ? colors.elevate1 : 'transparent',
          borderColor: 'transparent',
          textColor: colors.foreground,
          overlayColor: 'transparent',
        };
      case 'brand':
        // Brand button uses FIXED blue color for GUARANTEED visibility
        // This is critical for auth screens before user theme loads
        return {
          backgroundColor: pressed ? BRAND_COLORS.backgroundPressed : BRAND_COLORS.background,
          borderColor: BRAND_COLORS.border,
          textColor: BRAND_COLORS.text,
          overlayColor: 'transparent',
          // Shadow for better visibility on light backgrounds
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
          elevation: 8,
        };
      default:
        return {
          backgroundColor: colors.primary,
          borderColor: colors.primaryDark,
          textColor: colors.primaryForeground,
          overlayColor: elevateColor,
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { 
          minHeight: 32, 
          paddingHorizontal: 12, 
          paddingVertical: 0, 
          fontSize: 12, 
          borderRadius: 6 
        };
      case 'lg':
        return { 
          minHeight: 40, 
          paddingHorizontal: 32, 
          paddingVertical: 0, 
          fontSize: 14, 
          borderRadius: 6 
        };
      case 'xl':
        return { 
          minHeight: 56, 
          paddingHorizontal: 24, 
          paddingVertical: 14, 
          fontSize: 17, 
          borderRadius: 12 
        };
      case 'icon':
        return { 
          height: 36, 
          width: 36, 
          paddingHorizontal: 0, 
          paddingVertical: 0, 
          fontSize: 14, 
          borderRadius: 6 
        };
      default:
        return { 
          minHeight: 36, 
          paddingHorizontal: 16, 
          paddingVertical: 8, 
          fontSize: 14, 
          borderRadius: 6 
        };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => {
        const variantStyles = getVariantStyles(pressed);
        const baseStyles: ViewStyle = {
          backgroundColor: variantStyles.backgroundColor,
          borderColor: variantStyles.borderColor,
          borderWidth: 1,
          minHeight: sizeStyles.minHeight,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          paddingVertical: sizeStyles.paddingVertical,
          borderRadius: sizeStyles.borderRadius,
          opacity: disabled ? 0.5 : 1,
        };
        
        // Apply shadow properties if they exist (for brand variant)
        if (variantStyles.shadowColor) {
          baseStyles.shadowColor = variantStyles.shadowColor;
          baseStyles.shadowOffset = variantStyles.shadowOffset;
          baseStyles.shadowOpacity = variantStyles.shadowOpacity;
          baseStyles.shadowRadius = variantStyles.shadowRadius;
          baseStyles.elevation = variantStyles.elevation;
        }
        
        return [
          styles.button,
          baseStyles,
          size === 'icon' && { width: sizeStyles.width, height: sizeStyles.height },
          fullWidth && styles.fullWidth,
          style,
        ];
      }}
    >
      {({ pressed }) => {
        const variantStyles = getVariantStyles(pressed);
        return (
          <>
            {pressed && variantStyles.overlayColor !== 'transparent' && (
              <View 
                style={[
                  StyleSheet.absoluteFill, 
                  { 
                    backgroundColor: variantStyles.overlayColor,
                    borderRadius: sizeStyles.borderRadius,
                  }
                ]} 
              />
            )}
            {loading ? (
              <ActivityIndicator color={variantStyles.textColor} size="small" />
            ) : (
              <View style={styles.content}>
                {icon && <View style={styles.icon}>{icon}</View>}
                {typeof children === 'string' ? (
                  <Text
                    style={[
                      styles.text,
                      { color: variantStyles.textColor, fontSize: sizeStyles.fontSize },
                    ]}
                  >
                    {children}
                  </Text>
                ) : (
                  children
                )}
              </View>
            )}
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default Button;
