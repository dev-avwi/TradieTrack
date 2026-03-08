import { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Alert, InteractionManager, Dimensions, ActivityIndicator, AppState, AppStateStatus, Image, Animated, Easing } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';
import { useAuthStore } from '../src/lib/store';
import "../global.css";
import { useNotifications, useOfflineStorage, useLocationTracking, useStripeTerminal } from '../src/hooks/useServices';
import { isTapToPayAvailable } from '../src/lib/stripe-terminal';
import notificationService from '../src/lib/notifications';
import { router, usePathname } from 'expo-router';
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
import { isTablet, useShouldUseSidebar, isIPad, useOrientation } from '../src/lib/device';
import { MapPreferenceModal } from '../src/components/MapPreferenceModal';
import { WhatYouMissedPopup } from '../src/components/WhatYouMissedPopup';
import ErrorBoundary from '../src/components/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

async function checkForOTAUpdate() {
  if (__DEV__) return;
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      Alert.alert(
        'Update Available',
        'A new version has been downloaded. Restart to apply?',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Restart', onPress: () => Updates.reloadAsync() },
        ]
      );
    }
  } catch (e) {
    // Silently fail - OTA check is non-critical
  }
}

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
          InteractionManager.runAfterInteractions(() => {
            router.push(`/(auth)/accept-invite?token=${token}`);
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
      if (__DEV__) console.log('[DeepLink] Error handling deep link:', error);
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
  const runningLateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRunningLateJobRef = useRef<string | null>(null);
  const geofenceListenerRef = useRef(false);

  useEffect(() => {
    async function initServices() {
      try {
        const token = await notifications.initialize();
        
        // Sync push token with store
        const { setPushToken } = useNotificationsStore.getState();
        setPushToken(token);
        
        // Handle notification received while app is open
        notificationService.onReceived((notification) => {
          if (__DEV__) console.log('[App] Notification received:', notification);
          // Refresh in-app notifications when push arrives
          fetchNotifications();
        });
        
        // Handle notification tapped - navigate to relevant screen
        notificationService.onTapped((notification, action) => {
          if (__DEV__) console.log('[App] Notification tapped:', notification);
          
          // Navigate based on notification type
          const { type, data } = notification;
          
          switch (type) {
            case 'job_assigned':
            case 'job_update':
            case 'job_reminder':
            case 'job_scheduled':
            case 'job_started':
            case 'job_completed':
            case 'geofence_checkin':
            case 'geofence_checkout':
            case 'geofence':
            case 'running_late':
            case 'recurring_job_created':
              if (data?.jobId) {
                router.push(`/job/${data.jobId}`);
              }
              break;

            case 'quote_accepted':
            case 'quote_rejected':
            case 'quote_sent':
            case 'quote_expiring':
              if (data?.quoteId) {
                router.push(`/more/quote/${data.quoteId}`);
              }
              break;

            case 'payment_received':
            case 'payment_failed':
            case 'invoice_overdue':
            case 'invoice_sent':
            case 'installment_due':
            case 'installment_received':
            case 'recurring_invoice_created':
              if (data?.invoiceId) {
                router.push(`/more/invoice/${data.invoiceId}`);
              }
              break;

            case 'team_message':
            case 'chat_message':
              if (data?.chatType === 'team') {
                router.push('/more/team-chat');
              } else if (data?.chatType === 'direct' || data?.conversationId) {
                router.push('/more/direct-messages');
              } else {
                router.push('/more/chat-hub');
              }
              break;

            case 'sms_received':
              if (data?.conversationId) {
                router.push(`/more/sms/${data.conversationId}`);
              } else {
                router.push('/more/sms');
              }
              break;

            case 'team_invite':
              router.push('/more/team');
              break;

            case 'timesheet_submitted':
              router.push('/more/timesheets');
              break;

            case 'trial_expiring':
              router.push('/more/subscription');
              break;

            case 'daily_summary':
            case 'weekly_summary':
            case 'automation':
            case 'general':
            default:
              fetchNotifications();
              router.push('/more/notifications-inbox');
          }
        });
      } catch (error) {
        if (__DEV__) console.log('[App] Notifications not available (requires device)');
      }

      try {
        await offline.initialize();
      } catch (error) {
        if (__DEV__) console.log('[App] Offline storage init failed:', error);
      }

      try {
        await location.initialize();
        const { locationTracking } = await import('../src/lib/location-tracking');
        
        // Sync geofences for all jobs that have geofencing enabled
        locationTracking.syncJobGeofences();

        // Listen for geofence enter/exit events and show notifications (guard against duplicate registration)
        if (!geofenceListenerRef.current) {
        geofenceListenerRef.current = true;
        location.onGeofenceEvent(async (event) => {
          if (__DEV__) console.log('[App] Geofence event:', event);
          const jobId = event.identifier.replace('job_', '');
          
          try {
            // Post to server — handles auto clock-in/out and returns result
            const response = await api.post('/api/geofence-events', {
              identifier: event.identifier,
              action: event.action,
              timestamp: event.timestamp,
            });

            const data = response.data || response;
            const jobTitle = data?.jobTitle || 'Job site';
            const timeAction = data?.timeEntryAction;

            let title = '';
            let body = '';

            if (event.action === 'enter') {
              if (timeAction?.type === 'clock_in') {
                title = 'Arrived — Timer Started';
                body = `You've arrived at ${jobTitle}. Time tracking has been auto-started.`;
              } else {
                title = 'Arrived on Site';
                body = `You've arrived at ${jobTitle}. Tap to view job details.`;
              }
            } else {
              if (timeAction?.type === 'clock_out') {
                const dur = timeAction.duration ? ` (${Math.round(timeAction.duration / 60)} min logged)` : '';
                title = 'Left Site — Timer Stopped';
                body = `You've left ${jobTitle}. Time tracking auto-stopped${dur}.`;
              } else {
                title = 'Left Job Site';
                body = `You've left ${jobTitle}. Don't forget to log your time.`;
              }
            }

            await notificationService.scheduleLocalNotification(title, body, {
              type: 'geofence',
              jobId,
              action: event.action,
            });
          } catch (err) {
            if (__DEV__) console.log('[App] Geofence event handling error:', err);
            // Still show a basic notification even if server call fails
            const action = event.action === 'enter' ? 'Arrived on site' : 'Left site';
            await notificationService.scheduleLocalNotification(action, 'Tap to view job details.', {
              type: 'geofence',
              jobId,
            });
          }
        });
        } // end geofence listener guard
      } catch (error) {
        if (__DEV__) console.log('[App] Location init failed:', error);
      }

      // Smart Running Late Detection — check every 5 minutes
      if (runningLateIntervalRef.current) clearInterval(runningLateIntervalRef.current);
      runningLateIntervalRef.current = setInterval(async () => {
        try {
          // Get current preference
          const prefsRes = await api.get('/api/notification-preferences');
          if (prefsRes.error || prefsRes.data?.smartRunningLateEnabled === false || prefsRes.data?.pushNotificationsEnabled === false) return;

          // Get GPS
          const loc = await location.getCurrentLocation();
          if (!loc?.latitude) return;

          const checkRes = await api.post('/api/smart-running-late/check', {
            latitude: loc.latitude,
            longitude: loc.longitude,
          });

          const result = checkRes.data || checkRes;
          if (result?.runningLate && result.jobId && result.jobId !== lastRunningLateJobRef.current) {
            lastRunningLateJobRef.current = result.jobId;
            const scheduledTime = result.scheduledAt ? new Date(result.scheduledAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : '';
            await notificationService.scheduleLocalNotification(
              `Running Late for ${result.jobTitle}`,
              `You're ~${result.lateByMinutes} min behind for ${scheduledTime ? `your ${scheduledTime} job` : 'your next job'}. Tap to notify ${result.clientName}.`,
              { type: 'running_late', jobId: result.jobId }
            );
          }
        } catch (err) {
          if (__DEV__) console.log('[App] Running late check error:', err);
        }
      }, 5 * 60 * 1000);

      // Apple Requirement 1.4: Initialize/warm Terminal at app launch for faster checkout
      // Only initialize if Tap to Pay is available on this device
      if (isTapToPayAvailable() && !terminalInitializedRef.current) {
        try {
          if (__DEV__) console.log('[App] Warming up Stripe Terminal for faster checkout...');
          await terminal.initialize();
          terminalInitializedRef.current = true;
        } catch (error) {
          if (__DEV__) console.log('[App] Terminal warm-up failed (non-critical):', error);
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
        if (__DEV__) console.log('[App] App came to foreground - warming Terminal...');
        try {
          await terminal.initialize();
        } catch (error) {
          if (__DEV__) console.log('[App] Terminal foreground warm-up failed (non-critical):', error);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      if (runningLateIntervalRef.current) {
        clearInterval(runningLateIntervalRef.current);
        runningLateIntervalRef.current = null;
      }
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
  const shouldUseSidebar = useShouldUseSidebar();
  const orientation = useOrientation();

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
  
  const pathname = usePathname();
  const isChatScreen = pathname?.includes('/chat') || pathname?.includes('/direct-messages') || pathname?.includes('/sms-conversation') || pathname?.includes('/team-chat');
  const showFab = !isChatScreen;
  const isTeamOwner = isOwner() && hasActiveTeam();

  // Unauthenticated: render children with safe area padding (no header/nav)
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        {children}
      </View>
    );
  }

  // iPad Landscape / Tablet: Sidebar layout with header in content area
  if (shouldUseSidebar) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, position: 'relative', overflow: 'visible' }]}>
        <View style={styles.tabletLayout}>
          {/* Sidebar on the left */}
          <SidebarNav />
          
          {/* Main content area on the right */}
          <View style={styles.tabletContent}>
            {/* Header at top of content area - show JobRunner branding like web, hide avatar (in sidebar) */}
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

  // iPhone / iPad Portrait: Bottom nav layout
  return (
    <View style={[styles.container, { backgroundColor: colors.background, position: 'relative', overflow: 'visible' }]}>
      {/* Header at top in normal flow */}
      <Header />
      
      {/* Main content area - fills remaining space */}
      <View style={[styles.content, { paddingBottom: bottomNavHeight }]}>
        {children}
      </View>
      
      {/* Overlays */}
      <OfflineBanner />
      <ConflictResolutionPanel />
      <OfflineIndicator />
      <WhatYouMissedPopup />
      
      {/* FAB positioned above bottom nav */}
      {showFab && <FloatingActionButton isTeamOwner={isTeamOwner} bottomOffset={bottomNavHeight} />}
      
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
            source={require('../assets/jobrunner-logo.png')} 
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
  const [appReady, setAppReady] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const dataPreloaded = useRef(false);

  useEffect(() => {
    checkAuth();
    checkForOTAUpdate();
    
    const minTimer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 1500);
    
    const maxTimer = setTimeout(() => {
      setAppReady(true);
    }, 8000);
    
    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
    };
  }, []);

  useEffect(() => {
    if (isInitialized && !isLoading && isAuthenticated && !dataPreloaded.current) {
      dataPreloaded.current = true;
      
      const preloadData = async () => {
        try {
          const { useJobsStore, useDashboardStore, useClientsStore } = require('../src/lib/store');
          await Promise.all([
            useJobsStore.getState().fetchTodaysJobs(),
            useDashboardStore.getState().fetchStats(),
            useClientsStore.getState().fetchClients(),
          ]);
        } catch (error) {
          if (__DEV__) console.log('[App] Data preload error (non-fatal):', error);
        } finally {
          setAppReady(true);
        }
      };
      
      preloadData();
    }
    
    if (isInitialized && !isLoading && !isAuthenticated) {
      setAppReady(true);
    }
  }, [isInitialized, isLoading, isAuthenticated]);

  const [renderReady, setRenderReady] = useState(false);
  
  const showLoading = !isInitialized || isLoading || !appReady || !minTimeElapsed;
  
  useEffect(() => {
    if (!showLoading && !renderReady) {
      InteractionManager.runAfterInteractions(() => {
        setRenderReady(true);
      });
    }
  }, [showLoading, renderReady]);
  
  if (showLoading || !renderReady) {
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
    <ErrorBoundary>
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
    </ErrorBoundary>
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
