import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/lib/store';
import { LoadingScreen } from '../src/components/ui/LoadingScreen';

export default function Index() {
  const { isAuthenticated, isLoading, isInitialized, checkAuth, user } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  if (!isInitialized || isLoading) {
    return <LoadingScreen message="Loading TradieTrack..." />;
  }

  if (isAuthenticated) {
    // Platform admins go directly to admin dashboard
    if (user?.isPlatformAdmin === true) {
      return <Redirect href="/more/admin" />;
    }
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
