import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'JobRunner',
  slug: 'jobrunner',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'jobrunner',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.jobrunner.app',
    newArchEnabled: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: 'JobRunner needs camera access to take job photos',
      NSPhotoLibraryUsageDescription: 'JobRunner needs photo library access to upload job photos',
      NSLocationWhenInUseUsageDescription: 'JobRunner needs location access to track job sites',
      NSLocationAlwaysAndWhenInUseUsageDescription: 'JobRunner needs location access for team tracking',
      NFCReaderUsageDescription: 'JobRunner uses NFC for Tap to Pay contactless payments',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: 'com.jobrunner.app',
    newArchEnabled: true,
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
    'expo-font',
    'expo-audio',
    [
      'expo-camera',
      {
        cameraPermission: 'Allow JobRunner to take job photos',
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission: 'Allow JobRunner to track your location for team features',
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
    eas: {
      projectId: '78e88ca7-014e-438b-8170-1ccae4cd9386',
    },
  },
});
