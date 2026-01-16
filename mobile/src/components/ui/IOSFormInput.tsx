/**
 * Native iOS Form Input Components
 * Provides iOS-style form inputs with proper keyboard behavior
 * Falls back to standard inputs on Android
 */
import { forwardRef, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TextInputProps, 
  StyleSheet, 
  Platform,
  TouchableOpacity,
  Switch,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../lib/theme';
import { isIOS } from '../../lib/device';
import { IOSCorners, IOSShadows, IOSSystemColors } from '../../lib/ios-design';
import { spacing, radius, typography } from '../../lib/design-tokens';

// Helper to get iOS colors based on theme
const getIOSColors = (isDark: boolean) => isDark ? IOSSystemColors.dark : IOSSystemColors.light;

interface IOSTextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  helper?: string;
  icon?: keyof typeof Feather.glyphMap;
  /** Show clear button when text is entered */
  clearable?: boolean;
  /** iOS-style inset (grouped list item) appearance */
  inset?: boolean;
  style?: ViewStyle;
}

export const IOSTextField = forwardRef<TextInput, IOSTextFieldProps>(({
  label,
  error,
  helper,
  icon,
  clearable = true,
  inset = false,
  style,
  value,
  onChangeText,
  placeholder,
  ...props
}, ref) => {
  const { colors, isDark } = useTheme();
  const iosColors = getIOSColors(isDark);
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = useCallback(() => {
    if (isIOS) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onChangeText?.('');
  }, [onChangeText]);

  if (isIOS) {
    return (
      <View style={[styles.iosContainer, style]}>
        {label && (
          <Text style={[styles.iosLabel, { color: iosColors.secondaryLabel }]}>
            {label.toUpperCase()}
          </Text>
        )}
        <View style={[
          styles.iosInputContainer,
          {
            backgroundColor: inset ? iosColors.secondarySystemGroupedBackground : iosColors.tertiarySystemFill,
            borderRadius: inset ? 0 : IOSCorners.button,
          },
          isFocused && {
            borderColor: IOSSystemColors.systemBlue,
            borderWidth: 2,
          },
          error && {
            borderColor: IOSSystemColors.systemRed,
            borderWidth: 1,
          },
        ]}>
          {icon && (
            <Feather
              name={icon}
              size={18}
              color={iosColors.placeholderText}
              style={styles.iosIcon}
            />
          )}
          <TextInput
            ref={ref}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={iosColors.placeholderText}
            style={[
              styles.iosInput,
              { color: iosColors.label },
              icon && styles.iosInputWithIcon,
            ]}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            selectionColor={IOSSystemColors.systemBlue}
            {...props}
          />
          {clearable && value && value.length > 0 && (
            <TouchableOpacity onPress={handleClear} style={styles.iosClearButton}>
              <View style={[styles.iosClearIcon, { backgroundColor: iosColors.tertiaryLabel }]}>
                <Feather name="x" size={10} color={isDark ? '#000' : '#fff'} />
              </View>
            </TouchableOpacity>
          )}
        </View>
        {error && (
          <Text style={[styles.iosError, { color: IOSSystemColors.systemRed }]}>
            {error}
          </Text>
        )}
        {helper && !error && (
          <Text style={[styles.iosHelper, { color: iosColors.secondaryLabel }]}>
            {helper}
          </Text>
        )}
      </View>
    );
  }

  // Android fallback
  return (
    <View style={[styles.androidContainer, style]}>
      {label && (
        <Text style={[styles.androidLabel, { color: colors.foreground }]}>
          {label}
        </Text>
      )}
      <View style={[
        styles.androidInputContainer,
        { 
          backgroundColor: colors.card,
          borderColor: error ? colors.destructive : colors.border,
        },
      ]}>
        {icon && (
          <Feather
            name={icon}
            size={20}
            color={colors.mutedForeground}
            style={styles.androidIcon}
          />
        )}
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.androidInput,
            { color: colors.foreground },
            icon && styles.androidInputWithIcon,
          ]}
          {...props}
        />
      </View>
      {error && (
        <Text style={[styles.androidError, { color: colors.destructive }]}>
          {error}
        </Text>
      )}
      {helper && !error && (
        <Text style={[styles.androidHelper, { color: colors.mutedForeground }]}>
          {helper}
        </Text>
      )}
    </View>
  );
});

IOSTextField.displayName = 'IOSTextField';

interface IOSToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  icon?: keyof typeof Feather.glyphMap;
  iconColor?: string;
  disabled?: boolean;
  style?: ViewStyle;
}

export function IOSToggleRow({
  label,
  description,
  value,
  onValueChange,
  icon,
  iconColor,
  disabled = false,
  style,
}: IOSToggleRowProps) {
  const { colors, isDark } = useTheme();
  const iosColors = getIOSColors(isDark);

  const handleChange = (newValue: boolean) => {
    if (isIOS) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onValueChange(newValue);
  };

  if (isIOS) {
    return (
      <View style={[styles.iosToggleRow, style]}>
        {icon && (
          <View style={[styles.iosToggleIcon, { backgroundColor: iconColor || IOSSystemColors.systemBlue }]}>
            <Feather name={icon} size={16} color="#fff" />
          </View>
        )}
        <View style={styles.iosToggleContent}>
          <Text style={[styles.iosToggleLabel, { color: iosColors.label }]}>
            {label}
          </Text>
          {description && (
            <Text style={[styles.iosToggleDescription, { color: iosColors.secondaryLabel }]}>
              {description}
            </Text>
          )}
        </View>
        <Switch
          value={value}
          onValueChange={handleChange}
          disabled={disabled}
          trackColor={{ 
            false: iosColors.systemFill, 
            true: IOSSystemColors.systemGreen 
          }}
          thumbColor="#fff"
          ios_backgroundColor={iosColors.systemFill}
        />
      </View>
    );
  }

  // Android fallback
  return (
    <View style={[styles.androidToggleRow, style]}>
      {icon && (
        <View style={[styles.androidToggleIcon, { backgroundColor: iconColor || colors.primary }]}>
          <Feather name={icon} size={18} color="#fff" />
        </View>
      )}
      <View style={styles.androidToggleContent}>
        <Text style={[styles.androidToggleLabel, { color: colors.foreground }]}>
          {label}
        </Text>
        {description && (
          <Text style={[styles.androidToggleDescription, { color: colors.mutedForeground }]}>
            {description}
          </Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={handleChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={value ? '#fff' : colors.card}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // iOS Text Field styles
  iosContainer: {
    marginBottom: 16,
  },
  iosLabel: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.08,
    marginBottom: 6,
    marginLeft: 16,
    textTransform: 'uppercase',
  },
  iosInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  iosIcon: {
    marginRight: 8,
  },
  iosInput: {
    flex: 1,
    fontSize: 17,
    letterSpacing: -0.41,
    paddingVertical: 12,
  },
  iosInputWithIcon: {
    paddingLeft: 0,
  },
  iosClearButton: {
    padding: 4,
  },
  iosClearIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosError: {
    fontSize: 13,
    marginTop: 4,
    marginLeft: 16,
  },
  iosHelper: {
    fontSize: 13,
    marginTop: 4,
    marginLeft: 16,
    lineHeight: 18,
  },

  // iOS Toggle styles
  iosToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  iosToggleIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iosToggleContent: {
    flex: 1,
    marginRight: 12,
  },
  iosToggleLabel: {
    fontSize: 17,
    letterSpacing: -0.41,
  },
  iosToggleDescription: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 16,
  },

  // Android Text Field styles
  androidContainer: {
    marginBottom: spacing.md,
  },
  androidLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  androidInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  androidIcon: {
    marginRight: spacing.xs,
  },
  androidInput: {
    flex: 1,
    fontSize: typography.body.fontSize,
    paddingVertical: spacing.sm,
  },
  androidInputWithIcon: {
    paddingLeft: 0,
  },
  androidError: {
    fontSize: typography.caption.fontSize,
    marginTop: spacing.xs,
  },
  androidHelper: {
    fontSize: typography.caption.fontSize,
    marginTop: spacing.xs,
  },

  // Android Toggle styles
  androidToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  androidToggleIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  androidToggleContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  androidToggleLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
  },
  androidToggleDescription: {
    fontSize: typography.caption.fontSize,
    marginTop: 2,
  },
});

export default IOSTextField;
