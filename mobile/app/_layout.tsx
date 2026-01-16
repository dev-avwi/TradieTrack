import { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Alert, InteractionManager, Dimensions, ActivityIndicator, AppState, AppStateStatus, Image, Animated, Easing } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../src/lib/store';
import "../global.css";
import { useNotifications, useOfflineStorage, useLocationTracking, useStripeTerminal } from '../src/hooks/useServices';
import { isTapToPayAvailable } from '../src/lib/stripe-terminal';
import notificationService from '../src/lib/notifications';
import { router } from 'expo-router';
import { ThemeProvider, useTheme } from '../src/lib/theme';
import { BottomNav, getBottomNavHeight } from '../src/components/BottomNav';
import { SidebarNav, getSidebarWidth } from '../src/components/SidebarNav';
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
import { isTablet } from '../src/lib/device';
import { MapPreferenceModal } from '../src/components/MapPreferenceModal';
import { WhatYouMissedPopup } from '../src/components/WhatYouMissedPopup';

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
            const response = await api.get<{ success?: boolean }>(`/api/verify-email?token=${token}`);
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
  const terminal = useStripeTerminal();
  const { fetchNotifications } = useNotificationsStore();
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const terminalInitializedRef = useRef(false);

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

      // Apple Requirement 1.4: Initialize/warm Terminal at app launch for faster checkout
      // Only initialize if Tap to Pay is available on this device
      if (isTapToPayAvailable() && !terminalInitializedRef.current) {
        try {
          console.log('[App] Warming up Stripe Terminal for faster checkout...');
          await terminal.initialize();
          terminalInitializedRef.current = true;
        } catch (error) {
          console.log('[App] Terminal warm-up failed (non-critical):', error);
        }
      }
    }

    initServices();

    // Apple Requirement 1.4: Re-initialize Terminal when app comes to foreground
    // This ensures Terminal is ready for quick payment processing
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isTapToPayAvailable()
      ) {
        console.log('[App] App came to foreground - warming Terminal...');
        try {
          await terminal.initialize();
        } catch (error) {
          console.log('[App] Terminal foreground warm-up failed (non-critical):', error);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return null;
}

function useIsTablet() {
  const [tablet, setTablet] = useState(() => isTablet());
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setTablet(isTablet());
    });
    return () => subscription.remove();
  }, []);
  
  return tablet;
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const { fetchNotifications } = useNotificationsStore();
  const { isAuthenticated, isOwner, isStaff, hasActiveTeam } = useAuthStore();
  const { colors } = useTheme();
  const { isOnline, isInitialized: offlineInitialized } = useOfflineStore();
  const isTabletDevice = useIsTablet();

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
  
  // Compute FAB visibility - always show on tablet, otherwise show for owners/non-staff
  const showFab = isTabletDevice ? true : (isOwner() || !isStaff());
  const isTeamOwner = isOwner() && hasActiveTeam();

  // Unauthenticated: render children with safe area padding (no header/nav)
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        {children}
      </View>
    );
  }

  // iPad: Sidebar layout with header in content area
  if (isTabletDevice) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, position: 'relative', overflow: 'visible' }]}>
        <View style={styles.tabletLayout}>
          {/* Sidebar on the left */}
          <SidebarNav />
          
          {/* Main content area on the right */}
          <View style={styles.tabletContent}>
            {/* Header at top of content area - show TradieTrack branding like web, hide avatar (in sidebar) */}
            <Header showMenuButton={true} showAvatar={false} />
            
            {/* Content fills remaining space */}
            <View style={styles.content}>
              {children}
            </View>
          </View>
        </View>
        
        {/* Overlays */}
        <OfflineBanner />
        <ConflictResolutionPanel />
        <OfflineIndicator />
        <WhatYouMissedPopup />
        
        {/* FAB positioned in content area - right of sidebar */}
        {showFab && (
          <View style={styles.tabletFabWrapper} pointerEvents="box-none">
            <FloatingActionButton isTeamOwner={isTeamOwner} fabStyle="tablet" />
          </View>
        )}
      </View>
    );
  }

  // iPhone: Bottom nav layout (default)
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header at top in normal flow */}
      <Header />
      
      {/* Main content area - fills remaining space */}
      <View style={[
        styles.content, 
        { 
          paddingBottom: bottomNavHeight,
        }
      ]}>
        {children}
      </View>
      
      {/* Overlays */}
      <OfflineBanner />
      <ConflictResolutionPanel />
      <OfflineIndicator />
      <WhatYouMissedPopup />
      
      {/* FAB positioned above bottom nav */}
      {showFab && <FloatingActionButton isTeamOwner={isTeamOwner} />}
      
      {/* Bottom navigation */}
      <BottomNav />
    </View>
  );
}

function LoadingScreen({ colors }: { colors: any }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    // Gentle pulsing animation for the logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    // Smooth rotation for the loading ring
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);
  
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  
  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center', 
      backgroundColor: colors.background 
    }}>
      <View style={{ 
        width: 140, 
        height: 140, 
        justifyContent: 'center', 
        alignItems: 'center',
        marginBottom: 24,
      }}>
        {/* Outer rotating ring */}
        <Animated.View
          style={{
            position: 'absolute',
            width: 140,
            height: 140,
            borderRadius: 70,
            borderWidth: 3,
            borderColor: 'transparent',
            borderTopColor: colors.primary,
            borderRightColor: colors.primary + '40',
            transform: [{ rotate: spin }],
          }}
        />
        
        {/* Inner pulsing logo container */}
        <Animated.View
          style={{
            width: 110,
            height: 110,
            borderRadius: 55,
            backgroundColor: colors.card,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 8,
            transform: [{ scale: pulseAnim }],
          }}
        >
          <Image 
            source={require('../assets/tradietrack-logo.png')} 
            style={{ 
              width: 85, 
              height: 85, 
              resizeMode: 'contain',
            }} 
          />
        </Animated.View>
      </View>
      
      {/* Loading text with subtle fade */}
      <Animated.Text
        style={{
          fontSize: 14,
          color: colors.mutedForeground,
          fontWeight: '500',
          opacity: 0.8,
        }}
      >
        Loading...
      </Animated.Text>
    </View>
  );
}

function RootLayoutContent() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const { colors, isDark } = useTheme();
  const [minLoadingComplete, setMinLoadingComplete] = useState(false);

  useEffect(() => {
    checkAuth();
    
    // Minimum loading screen display time (2 seconds)
    // This gives the dashboard time to fully load before appearing
    const timer = setTimeout(() => {
      setMinLoadingComplete(true);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, []);

  // Show loading screen until auth is ready AND minimum time has passed
  if (!isInitialized || isLoading || !minLoadingComplete) {
    return <LoadingScreen colors={colors} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <DeepLinkHandler />
      <ServicesInitializer />
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <MapPreferenceModal />
      <WhatYouMissedPopup />
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
  tabletLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  tabletContent: {
    flex: 1,
  },
  tabletFabWrapper: {
    position: 'absolute',
    left: 280, // SIDEBAR_WIDTH constant
    right: 0,
    bottom: 0,
    top: 0,
    pointerEvents: 'box-none',
    zIndex: 9999,
    elevation: 9999,
  },
});
