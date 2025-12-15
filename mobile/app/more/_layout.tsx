import { Stack, router } from 'expo-router';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';

function IOSBackButton() {
  const { colors } = useTheme();
  
  return (
    <TouchableOpacity 
      onPress={() => router.back()}
      activeOpacity={0.7}
      style={styles.backButton}
    >
      <Feather name="chevron-left" size={24} color={colors.primary} />
      <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -8,
  },
  backText: {
    fontSize: 17,
    fontWeight: '400',
  },
});

export default function MoreLayout() {
  const { colors } = useTheme();
  
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackVisible: false,
        headerLeft: () => <IOSBackButton />,
        headerTitle: '',
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: colors.background,
        },
        contentStyle: {
          backgroundColor: colors.background,
        },
        animation: 'ios_from_right',
        animationDuration: 220,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        presentation: 'card',
        freezeOnBlur: true,
      }}
    />
  );
}
