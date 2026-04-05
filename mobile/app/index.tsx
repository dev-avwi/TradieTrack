import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../src/lib/store';
import { useTheme } from '../src/lib/theme';

export default function Index() {
  const { isAuthenticated, isLoading, isInitialized, user } = useAuthStore();
  const { colors } = useTheme();

  useEffect(() => {
    if (!isInitialized || isLoading) return;

    if (isAuthenticated) {
      if (user?.isPlatformAdmin === true) {
        router.replace('/more/admin');
      } else {
        const { businessSettings } = useAuthStore.getState();
        if (!businessSettings?.onboardingCompleted) {
          router.replace('/(onboarding)/setup');
        } else {
          router.replace('/(tabs)');
        }
      }
    } else {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, isLoading, isInitialized, user]);

  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}
