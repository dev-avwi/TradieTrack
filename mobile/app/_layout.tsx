import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/lib/store';
import "../global.css";
import { useNotifications, useOfflineStorage, useLocationTracking } from '../src/hooks/useServices';
import notificationService from '../src/lib/notifications';
import { router } from 'expo-router';
import { ThemeProvider, useTheme } from '../src/lib/theme';
import { BottomNav, getBottomNavHeight } from '../src/components/BottomNav';
import { Header } from '../src/components/Header';
import { useNotificationsStore } from '../src/lib/notifications-store';
import { FloatingActionButton } from '../src/components/FloatingActionButton';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function ServicesInitializer() {
  const notifications = useNotifications();
  const offline = useOfflineStorage();
  const location = useLocationTracking();

  useEffect(() => {
    async function initServices() {
      try {
        await notifications.initialize();
        
        notificationService.onTapped((notification, action) => {
          console.log('[App] Notification tapped:', notification);
          if (notification.data?.jobId) {
            router.push(`/job/${notification.data.jobId}`);
          }
        });
      } catch (error) {
        console.log('[App] Notifications not available (requires device)');
      }

      try {
        await offline.initialize();
      } catch (error) {
        console.log('[App] Offline storage init failed:', error);
      }

      try {
        await location.initialize();
      } catch (error) {
        console.log('[App] Location init failed:', error);
      }
    }

    initServices();
  }, []);

  return null;
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const { unreadCount, fetchNotifications } = useNotificationsStore();
  const { isAuthenticated } = useAuthStore();
  const { colors } = useTheme();

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <Header />
      <View style={[styles.content, { paddingBottom: bottomNavHeight }]}>
        {children}
      </View>
      <FloatingActionButton />
      <BottomNav />
    </View>
  );
}

function RootLayoutContent() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { colors, isDark } = useTheme();

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ServicesInitializer />
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthenticatedLayout>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: colors.background,
            },
            animation: 'ios_from_right',
            animationDuration: 200,
            gestureEnabled: true,
            gestureDirection: 'horizontal',
            presentation: 'card',
            freezeOnBlur: true,
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="job/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="more" options={{ headerShown: false }} />
        </Stack>
      </AuthenticatedLayout>
    </View>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootLayoutContent />
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
