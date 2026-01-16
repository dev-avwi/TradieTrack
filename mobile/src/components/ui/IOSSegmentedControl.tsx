import { View, Text, Pressable, StyleSheet, LayoutChangeEvent, Animated, ViewStyle } from 'react-native';
import { useState, useRef, useEffect, ReactNode } from 'react';
import { useTheme } from '../../lib/theme';
import { isIOS, getIOSSegmentedControlStyle, IOSSystemColors } from '../../lib/ios-design';

interface Segment {
  key: string;
  label: string;
  icon?: ReactNode;
}

interface IOSSegmentedControlProps {
  segments: Segment[];
  selectedKey: string;
  onSelect: (key: string) => void;
  style?: ViewStyle;
}

export function IOSSegmentedControl({
  segments,
  selectedKey,
  onSelect,
  style,
}: IOSSegmentedControlProps) {
  const { isDark, colors } = useTheme();
  const [segmentWidth, setSegmentWidth] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  
  const selectedIndex = segments.findIndex(s => s.key === selectedKey);
  
  useEffect(() => {
    if (segmentWidth > 0) {
      Animated.spring(slideAnim, {
        toValue: selectedIndex * segmentWidth,
        useNativeDriver: true,
        tension: 300,
        friction: 30,
      }).start();
    }
  }, [selectedIndex, segmentWidth]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    const calculatedWidth = (width - 4) / segments.length;
    setSegmentWidth(calculatedWidth);
  };

  if (isIOS) {
    const iosStyles = getIOSSegmentedControlStyle(isDark);
    
    return (
      <View 
        style={[iosStyles.container, style]} 
        onLayout={handleLayout}
      >
        {segmentWidth > 0 && (
          <Animated.View
            style={[
              iosStyles.indicator,
              {
                position: 'absolute',
                top: 2,
                left: 2,
                width: segmentWidth,
                height: '100%',
                transform: [{ translateX: slideAnim }],
              },
            ]}
          />
        )}
        
        {segments.map((segment, index) => {
          const isSelected = segment.key === selectedKey;
          
          return (
            <Pressable
              key={segment.key}
              style={[
                iosStyles.segment,
                { width: segmentWidth > 0 ? segmentWidth : undefined },
              ]}
              onPress={() => onSelect(segment.key)}
            >
              {segment.icon && (
                <View style={localStyles.iconContainer}>
                  {segment.icon}
                </View>
              )}
              <Text style={isSelected ? iosStyles.selectedText : iosStyles.text}>
                {segment.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View style={[localStyles.androidContainer, { backgroundColor: colors.muted }, style]}>
      {segments.map((segment, index) => {
        const isSelected = segment.key === selectedKey;
        
        return (
          <Pressable
            key={segment.key}
            style={[
              localStyles.androidSegment,
              isSelected && { backgroundColor: colors.card },
            ]}
            onPress={() => onSelect(segment.key)}
          >
            {segment.icon && (
              <View style={localStyles.iconContainer}>
                {segment.icon}
              </View>
            )}
            <Text
              style={[
                localStyles.androidText,
                { color: isSelected ? colors.foreground : colors.mutedForeground },
                isSelected && localStyles.androidSelectedText,
              ]}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const localStyles = StyleSheet.create({
  iconContainer: {
    marginRight: 4,
  },
  androidContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 2,
  },
  androidSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  androidText: {
    fontSize: 14,
    fontWeight: '500',
  },
  androidSelectedText: {
    fontWeight: '600',
  },
});

export default IOSSegmentedControl;
