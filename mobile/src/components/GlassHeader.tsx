import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../lib/theme';
import { HEADER_HEIGHT } from '../lib/design-tokens';

const isIOS = Platform.OS === 'ios';

interface GlassHeaderProps {
  title?: string;
  onBack?: () => void;
  backLabel?: string;
  rightActions?: React.ReactNode;
  transparent?: boolean;
}

export function GlassHeader({ 
  title, 
  onBack, 
  backLabel = 'Back',
  rightActions,
  transparent = false,
}: GlassHeaderProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };
  
  const headerContent = (
    <View style={[
      styles.headerContent,
      { paddingTop: insets.top, height: HEADER_HEIGHT + insets.top }
    ]}>
      <TouchableOpacity 
        onPress={handleBack}
        style={styles.backButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
      >
        <Feather name="chevron-left" size={28} color={colors.foreground} />
        {backLabel && (
          <Text style={[styles.backLabel, { color: colors.foreground }]}>
            {backLabel}
          </Text>
        )}
      </TouchableOpacity>
      
      {title && (
        <Text 
          style={[styles.title, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {title}
        </Text>
      )}
      
      <View style={styles.rightSection}>
        {rightActions}
      </View>
    </View>
  );
  
  if (transparent) {
    return (
      <View style={styles.container}>
        {headerContent}
      </View>
    );
  }
  
  if (isIOS) {
    return (
      <BlurView
        intensity={80}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.container,
          { 
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
          }
        ]}
      >
        {headerContent}
      </BlurView>
    );
  }
  
  return (
    <View style={[
      styles.container, 
      { 
        backgroundColor: colors.card,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
      }
    ]}>
      {headerContent}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 8,
    minWidth: 60,
  },
  backLabel: {
    fontSize: 17,
    fontWeight: '400',
    marginLeft: -2,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 60,
    justifyContent: 'flex-end',
  },
});
