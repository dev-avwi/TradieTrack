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
import { TerminalProvider } from '../src/providers/StripeTerminalProvider';
import { OfflineBanner, OfflineIndicator } from '../src/components/OfflineIndicator';
import { ConflictResolutionPanel } from '../src/components/ConflictResolutionPanel';
import { useOfflineStore } from '../src/lib/offline-storage';
import offlineStorage from '../src/lib/offline-storage';
import { ScrollProvider } from '../src/contexts/ScrollContext';

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
  const { fetchNotifications } = useNotificationsStore();

  useEffect(() => {
    async function initServices() {
      try {
        const token = await notifications.initialize();
        
        // Sync push token with store
        const { setPushToken } = useNotificationsStore.getState();
        setPushToken(token);
        
        // Handle notification received while app is open
        notificationService.onReceived((notification) => {
          console.log('[App] Notification received:', notification);
          // Refresh in-app notifications when push arrives
          fetchNotifications();
        });
        
        // Handle notification tapped - navigate to relevant screen
        notificationService.onTapped((notification, action) => {
          console.log('[App] Notification tapped:', notification);
          
          // Navigate based on notification type
          const { type, data } = notification;
          
          switch (type) {
            case 'job_assigned':
            case 'job_update':
            case 'job_reminder':
              if (data?.jobId) {
                router.push(`/job/${data.jobId}`);
              }
              break;
              
            case 'quote_accepted':
            case 'quote_rejected':
              if (data?.quoteId) {
                router.push(`/more/quote/${data.quoteId}`);
              }
              break;
              
            case 'payment_received':
            case 'invoice_overdue':
              if (data?.invoiceId) {
                router.push(`/more/invoice/${data.invoiceId}`);
              }
              break;
              
            case 'team_message':
              // Navigate to appropriate chat based on chatType or conversationId
              if (data?.chatType === 'team') {
                router.push('/more/team-chat');
              } else if (data?.chatType === 'direct' || data?.conversationId) {
                router.push('/more/direct-messages');
              } else {
                router.push('/more/chat-hub');
              }
              break;
              
            case 'general':
            default:
              // Default to notifications inbox and refresh
              fetchNotifications();
              router.push('/more/notifications-inbox');
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
  const { isOnline, isInitialized: offlineInitialized } = useOfflineStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Trigger full sync when coming online or after authentication
  useEffect(() => {
    if (isAuthenticated && isOnline && offlineInitialized) {
      offlineStorage.fullSync();
    }
  }, [isAuthenticated, isOnline, offlineInitialized]);

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <Header />
      <OfflineBanner />
      <ConflictResolutionPanel />
      <OfflineIndicator />
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
          <ScrollProvider>
            <TerminalProvider>
              <RootLayoutContent />
            </TerminalProvider>
          </ScrollProvider>
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
