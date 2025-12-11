import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'TradieTrack',
  slug: 'tradietrack',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'tradietrack',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0f172a',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.tradietrack.app',
    infoPlist: {
      NSCameraUsageDescription: 'TradieTrack needs camera access to take job photos',
      NSPhotoLibraryUsageDescription: 'TradieTrack needs photo library access to upload job photos',
      NSLocationWhenInUseUsageDescription: 'TradieTrack needs location access to track job sites',
      NSLocationAlwaysAndWhenInUseUsageDescription: 'TradieTrack needs location access for team tracking',
      NFCReaderUsageDescription: 'TradieTrack uses NFC for Tap to Pay contactless payments',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0f172a',
    },
    package: 'com.tradietrack.app',
    permissions: [
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'NFC',
      'VIBRATE',
      'RECEIVE_BOOT_COMPLETED',
    ],
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-camera',
      {
        cameraPermission: 'Allow TradieTrack to take job photos',
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission: 'Allow TradieTrack to track your location for team features',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#f97316',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    router: {
      origin: false,
    },
    eas: {
      projectId: '78e88ca7-014e-438b-8170-1ccae4cd9386',
    },
  },
});
