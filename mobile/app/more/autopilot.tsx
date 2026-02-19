import { useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../src/lib/theme';
import { useAuthStore } from '../../src/lib/store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AutopilotScreen() {
  const { colors } = useTheme();
  const { token } = useAuthStore();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);

  const baseUrl = useAuthStore.getState().serverUrl || '';
  const pageUrl = `${baseUrl}/autopilot`;

  const injectedJS = `
    (function() {
      try {
        document.querySelector('[data-testid="sidebar-main"]')?.style.setProperty('display', 'none');
        document.querySelector('[data-testid="button-sidebar-toggle"]')?.style.setProperty('display', 'none');
        document.querySelector('header')?.style.setProperty('display', 'none');
        const mainEl = document.querySelector('main');
        if (mainEl) {
          mainEl.style.setProperty('height', '100vh');
          mainEl.style.setProperty('overflow', 'auto');
        }
      } catch(e) {}
    })();
    true;
  `;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ 
        title: 'Autopilot',
        headerShown: true,
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
      }} />
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading Autopilot...</Text>
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ 
          uri: pageUrl,
          headers: token ? { 'Cookie': `connect.sid=${token}` } : undefined
        }}
        style={[styles.webview, isLoading && styles.hidden]}
        onLoadEnd={() => setIsLoading(false)}
        injectedJavaScript={injectedJS}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        startInLoadingState={false}
        originWhitelist={['*']}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
  hidden: { opacity: 0 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: { marginTop: 12, fontSize: 14 },
});
