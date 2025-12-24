import { useEffect } from 'react';
import { View, StyleSheet, Alert, InteractionManager, Platform } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../src/lib/store';
import "../global.css";

const isIOS = Platform.OS === 'ios';

import { useNotifications, useOfflineStorage, useLocationTracking } from '../src/hooks/useServices';
import notificationService from '../src/lib/notifications';
import { router } from 'expo-router';
import { ThemeProvider, useTheme } from '../src/lib/theme';
import { BottomNav, getBottomNavHeight } from '../src/components/BottomNav';
import { Header } from '../src/components/Header';
import { useNotificationsStore } from '../src/lib/notifications-store';
import { TerminalProvider } from '../src/providers/StripeTerminalProvider';
import { OfflineBanner, OfflineIndicator } from '../src/components/OfflineIndicator';
import { ConflictResolutionPanel } from '../src/components/ConflictResolutionPanel';
import { useOfflineStore } from '../src/lib/offline-storage';
import offlineStorage from '../src/lib/offline-storage';
import { ScrollProvider } from '../src/contexts/ScrollContext';
import api from '../src/lib/api';
import { FloatingActionButton } from '../src/components/FloatingActionButton';
import { HEADER_HEIGHT } from '../src/lib/design-tokens';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

// Deep link handler for email flows (verify-email, accept-invite, reset-password)
function DeepLinkHandler() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  
  useEffect(() => {
    // Handle initial URL (when app opens from a deep link)
    const handleInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        handleDeepLink(initialUrl);
      }
    };
    
    // Handle deep links while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });
    
    handleInitialURL();
    
    return () => {
      subscription.remove();
    };
  }, []);
  
  const handleDeepLink = async (url: string) => {
    try {
      const parsed = Linking.parse(url);
      const { hostname, path, queryParams } = parsed;
      
      // Handle different deep link paths
      if (hostname === 'verify-email' || path === '/verify-email') {
        const token = queryParams?.token as string;
        if (token) {
          try {
            const response = await api.get(`/api/verify-email?token=${token}`);
            if (response.data?.success) {
              Alert.alert('Email Verified', 'Your email has been verified successfully!');
              checkAuth();
            } else {
              Alert.alert('Verification Failed', response.error || 'Failed to verify email');
            }
          } catch (error: any) {
            Alert.alert('Verification Failed', error.message || 'Failed to verify email');
          }
        }
      } else if (hostname === 'accept-invite' || path === '/accept-invite') {
        const token = queryParams?.token as string;
        if (token) {
          // Defer navigation until interactions complete for safety
          InteractionManager.runAfterInteractions(() => {
            router.push(`/(auth)/register?inviteToken=${token}`);
          });
        }
      } else if (hostname === 'reset-password' || path === '/reset-password') {
        const token = queryParams?.token as string;
        if (token) {
          // Defer navigation until interactions complete for safety
          InteractionManager.runAfterInteractions(() => {
            router.push(`/(auth)/reset-password?token=${token}`);
          });
        }
      } else if (hostname === 'xero-callback' || path === '/xero-callback') {
        // Xero OAuth callback - handled by integrations screen
        const success = queryParams?.success === 'true';
        if (success) {
          InteractionManager.runAfterInteractions(() => {
            router.push('/more/integrations');
          });
        }
      }
    } catch (error) {
      console.log('[DeepLink] Error handling deep link:', error);
    }
  };
  
  return null;
}

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

// Calculate total header height including safe area on iOS (for Liquid Glass effect)
function getHeaderHeight(topInset: number): number {
  return isIOS ? HEADER_HEIGHT + topInset : HEADER_HEIGHT;
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const headerHeight = getHeaderHeight(insets.top);
  const { fetchNotifications } = useNotificationsStore();
  const { isAuthenticated, isOwner, isStaff, hasActiveTeam } = useAuthStore();
  const { colors } = useTheme();
  const { isOnline, isInitialized: offlineInitialized } = useOfflineStore();
  const pathname = usePathname();
  
  // Detail pages that should NOT show global header (ServiceM8 style)
  // These pages have their own contextual headers with back buttons
  // Using comprehensive route matching for expo-router dynamic routes
  const isDetailPage = pathname.startsWith('/job/') || 
                       pathname.startsWith('/more/client/') ||
                       pathname.startsWith('/more/quote/') ||
                       pathname.startsWith('/more/invoice/') ||
                       pathname.startsWith('/more/team-management') ||
                       pathname.startsWith('/more/team-chat') ||
                       pathname.startsWith('/more/chat-hub') ||
                       pathname.startsWith('/more/direct-messages') ||
                       pathname.startsWith('/more/sms') ||
                       pathname.startsWith('/more/settings') ||
                       pathname.startsWith('/more/clients') ||
                       pathname.startsWith('/more/invoices') ||
                       pathname.startsWith('/more/quotes') ||
                       pathname.includes('/new') ||
                       pathname.includes('/edit');

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
  
  // Compute FAB visibility from centralized store
  const showFab = !isStaff();
  const isTeamOwner = isOwner() && hasActiveTeam();

  // Unauthenticated: render children with safe area padding (no header/nav)
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        {children}
      </View>
    );
  }

  // iOS Liquid Glass: Header is positioned absolutely with blur, content starts below it
  // Content can scroll underneath for the translucent effect
  // Detail pages hide global header and manage their own header
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Main content area - starts below header (or safe area on detail pages) */}
      <View style={[
        styles.content, 
        { 
          // Detail pages: just safe area top (they have their own header)
          // Main pages: safe area + header height
          paddingTop: isDetailPage ? insets.top : insets.top + HEADER_HEIGHT,
          paddingBottom: bottomNavHeight,
        }
      ]}>
        {children}
      </View>
      
      {/* Overlays */}
      <OfflineBanner />
      <ConflictResolutionPanel />
      <OfflineIndicator />
      
      {/* FAB positioned above bottom nav */}
      {showFab && <FloatingActionButton isTeamOwner={isTeamOwner} />}
      
      {/* Global header - hidden on detail pages (they have contextual headers) */}
      {!isDetailPage && (
        <View style={styles.headerContainer}>
          <Header />
        </View>
      )}
      
      {/* Bottom navigation with blur effect on iOS */}
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
      <DeepLinkHandler />
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
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
});
