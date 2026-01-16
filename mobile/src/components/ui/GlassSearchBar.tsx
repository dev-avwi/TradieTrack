/**
 * iOS 26 Liquid Glass Search Bar
 * 
 * A search bar with glass material that integrates with the Liquid Glass
 * design system. Content shows through the translucent background.
 */
import { useState, useRef } from 'react';
import { 
  View, 
  TextInput, 
  StyleSheet, 
  Pressable, 
  Text,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../lib/theme';
import { isIOS } from '../../lib/device';
import { LiquidGlass, IOSSystemColors, IOSTypography } from '../../lib/ios-design';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface GlassSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onSubmit?: () => void;
  showCancel?: boolean;
  autoFocus?: boolean;
}

export function GlassSearchBar({
  value,
  onChangeText,
  placeholder = 'Search',
  onFocus,
  onBlur,
  onSubmit,
  showCancel = true,
  autoFocus = false,
}: GlassSearchBarProps) {
  const { isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  
  const iosColors = isDark ? IOSSystemColors.dark : IOSSystemColors.light;
  
  // Glass colors
  const glassBackground = isDark
    ? 'rgba(118, 118, 128, 0.24)'  // iOS systemFill dark
    : 'rgba(118, 118, 128, 0.12)'; // iOS systemFill light
  
  const handleFocus = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsFocused(true);
    if (isIOS) {
      Haptics.selectionAsync();
    }
    onFocus?.();
  };
  
  const handleBlur = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsFocused(false);
    onBlur?.();
  };
  
  const handleCancel = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onChangeText('');
    inputRef.current?.blur();
    if (isIOS) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };
  
  const handleClear = () => {
    onChangeText('');
    if (isIOS) {
      Haptics.selectionAsync();
    }
  };
  
  return (
    <View style={styles.container}>
      <View style={[styles.searchContainer, isFocused && styles.searchContainerFocused]}>
        {/* Glass background */}
        {isIOS ? (
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
          </>
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.glassOverlay,
              { backgroundColor: iosColors.tertiarySystemFill },
            ]}
          />
        )}
        
        {/* Search icon */}
        <Feather 
          name="search" 
          size={16} 
          color={iosColors.placeholderText} 
          style={styles.searchIcon}
        />
        
        {/* Input */}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={iosColors.placeholderText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
          autoFocus={autoFocus}
          autoCorrect={false}
          autoCapitalize="none"
          style={[
            styles.input,
            { color: iosColors.label },
          ]}
        />
        
        {/* Clear button */}
        {value.length > 0 && (
          <Pressable onPress={handleClear} style={styles.clearButton}>
            <View style={[styles.clearIcon, { backgroundColor: iosColors.tertiaryLabel }]}>
              <Feather name="x" size={10} color={isDark ? '#000' : '#fff'} />
            </View>
          </Pressable>
        )}
      </View>
      
      {/* Cancel button */}
      {showCancel && isFocused && (
        <Pressable onPress={handleCancel} style={styles.cancelButton}>
          <Text style={[styles.cancelText, { color: IOSSystemColors.systemBlue }]}>
            Cancel
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    borderRadius: 10,
    overflow: 'hidden',
  },
  searchContainerFocused: {
    // Could add focus styling here
  },
  blurLayer: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  glassOverlay: {
    borderRadius: 10,
  },
  searchIcon: {
    marginLeft: 8,
    marginRight: 4,
  },
  input: {
    flex: 1,
    ...IOSTypography.body,
    paddingVertical: 8,
    paddingRight: 8,
  },
  clearButton: {
    padding: 8,
  },
  clearIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    marginLeft: 8,
    paddingVertical: 8,
  },
  cancelText: {
    ...IOSTypography.body,
  },
});

export default GlassSearchBar;
