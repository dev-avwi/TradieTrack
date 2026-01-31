// ResponsiveContainer - Wraps page content with proper iPad-responsive padding and centering
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useMemo } from 'react';
import { useResponsiveLayout } from '../lib/device';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  // If true, content will be centered with max width on iPad portrait
  centerOnIPad?: boolean;
  // Custom max width for iPad portrait (default: 600)
  maxWidth?: number;
}

export function ResponsiveContainer({ 
  children, 
  style,
  centerOnIPad = true,
  maxWidth = 600,
}: ResponsiveContainerProps) {
  const { isIPadPortrait, horizontalPadding, contentWidth } = useResponsiveLayout();
  
  const containerStyle = useMemo(() => {
    if (isIPadPortrait && centerOnIPad) {
      // Center content with max width on iPad portrait
      return {
        paddingHorizontal: horizontalPadding,
      };
    }
    return {};
  }, [isIPadPortrait, centerOnIPad, horizontalPadding]);
  
  return (
    <View style={[styles.container, containerStyle, style]}>
      {children}
    </View>
  );
}

// For use in ScrollView contentContainerStyle
export function useResponsiveContainerStyle(customMaxWidth?: number) {
  const { isIPadPortrait, horizontalPadding } = useResponsiveLayout();
  
  return useMemo(() => {
    if (isIPadPortrait) {
      return {
        paddingHorizontal: horizontalPadding,
      };
    }
    return {
      paddingHorizontal: 16,
    };
  }, [isIPadPortrait, horizontalPadding]);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
