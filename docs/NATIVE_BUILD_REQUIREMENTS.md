# Native Build Requirements for TradieTrack Mobile

This document outlines the requirements for building native iOS and Android apps with advanced features that require native code (not available in Expo Go).

## Overview

The current TradieTrack mobile app is built with Expo SDK 54 and React Native. Most features work in Expo Go, but some advanced features require a native build using EAS Build.

## Features Requiring Native Build

### 1. Tap to Pay (Stripe Terminal)

**Purpose**: Accept contactless payments directly from customer cards using NFC.

**Requirements**:
- iOS: Apple Developer Program membership ($99/year)
- iOS: Tap to Pay on iPhone entitlement (must apply to Apple)
- iOS: iPhone XS or newer with iOS 16+
- Android: Android 9+ with NFC support (most devices since 2018)

**Implementation**:
```bash
# Install Stripe Terminal SDK
npx expo install @stripe/stripe-terminal-react-native

# Add to app.json plugins
{
  "plugins": [
    "@stripe/stripe-terminal-react-native"
  ]
}
```

**Apple Entitlement Process**:
1. Join Apple Developer Program
2. Apply for Tap to Pay on iPhone entitlement at developer.apple.com
3. Wait for approval (typically 1-2 weeks)
4. Add entitlement to provisioning profile
5. Build with EAS Build

**Stripe Terminal Setup**:
1. Enable Stripe Terminal in Stripe Dashboard
2. Create connection tokens via backend API
3. Implement `StripeTerminalProvider` wrapper
4. Handle `discoverReaders()` → `connectReader()` → `collectPaymentMethod()` flow

### 2. Push Notifications

**Purpose**: Real-time alerts for job assignments, payments, and team messages.

**Requirements**:
- iOS: Apple Push Notification service (APNs) certificate
- Android: Firebase Cloud Messaging (FCM) configuration
- Backend: Notification server with push token management

**Implementation**:
```bash
# Already installed
expo-notifications
expo-device
```

**Setup Steps**:
1. Configure Firebase project and download `google-services.json`
2. Create APNs key in Apple Developer Console
3. Add credentials to EAS Build
4. Implement push token registration on app startup
5. Handle notification events in background/foreground

**Backend Integration**:
- Store device tokens per user in database
- Use FCM/APNs APIs to send targeted notifications
- Implement notification preferences (per-type opt-in/out)

### 3. Background GPS Location Tracking

**Purpose**: Life360-style team tracking for managers to see staff locations.

**Requirements**:
- iOS: Background location permission and Info.plist entries
- Android: Background location permission and foreground service
- Battery optimization handling

**Implementation**:
```bash
# Already installed
expo-location
expo-task-manager
```

**Configuration** (in app.json):
```json
{
  "expo": {
    "plugins": [
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow TradieTrack to track your location for team coordination.",
          "isIosBackgroundLocationEnabled": true,
          "isAndroidBackgroundLocationEnabled": true
        }
      ]
    ]
  }
}
```

**Implementation Pattern**:
```typescript
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
  if (error) return;
  const { locations } = data;
  // Send location to backend
  api.post('/api/team/location', { 
    latitude: locations[0].coords.latitude,
    longitude: locations[0].coords.longitude,
    speed: locations[0].coords.speed,
    timestamp: locations[0].timestamp
  });
});

// Start tracking
await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 30000, // 30 seconds
  distanceInterval: 50, // 50 meters
  foregroundService: {
    notificationTitle: 'TradieTrack',
    notificationBody: 'Location tracking active for team coordination',
  },
});
```

### 4. Offline Mode with SQLite

**Purpose**: Allow app to function without internet connection.

**Requirements**:
- Local SQLite database for data caching
- Sync queue for pending changes
- Conflict resolution strategy

**Implementation**:
```bash
# Already installed
expo-sqlite
```

**Sync Strategy**:
1. Cache all critical data (jobs, clients, quotes, invoices) locally
2. Queue mutations when offline
3. Sync queue when connection restored
4. Handle conflicts with "last-write-wins" or user prompt

**Data to Cache**:
- Active jobs and their details
- Client contact information
- Draft quotes/invoices
- Recent chat messages
- User preferences and settings

## Build Process

### EAS Build Setup

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo account
eas login

# Configure project for EAS Build
cd mobile
eas build:configure
```

### Building for Stores

**iOS**:
```bash
# Development build (for testing)
eas build --platform ios --profile development

# Production build for App Store
eas build --platform ios --profile production
```

**Android**:
```bash
# Development APK
eas build --platform android --profile development

# Production AAB for Play Store
eas build --platform android --profile production
```

### eas.json Configuration

```json
{
  "cli": {
    "version": ">= 8.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

## Store Requirements

### Apple App Store
1. Apple Developer Program membership ($99/year)
2. App Store Connect account setup
3. App icons (1024x1024)
4. Screenshots for all device sizes
5. Privacy policy URL
6. App description and metadata
7. Age rating questionnaire
8. App Review submission

### Google Play Store
1. Google Play Developer account ($25 one-time)
2. App signing key management
3. Feature graphic (1024x500)
4. Screenshots for phones and tablets
5. Privacy policy URL
6. Content rating questionnaire
7. Data safety form
8. Target audience and content

## Timeline Estimate

| Phase | Duration | Description |
|-------|----------|-------------|
| Credentials Setup | 1-2 days | Apple/Google developer accounts, certificates |
| Tap to Pay Entitlement | 1-2 weeks | Apple approval process |
| Native Code Integration | 3-5 days | Stripe Terminal, background location |
| Testing | 2-3 days | Device testing, edge cases |
| Store Submission | 1-2 weeks | Review process |
| **Total** | **3-4 weeks** | From start to store availability |

## Cost Summary

| Item | Cost | Frequency |
|------|------|-----------|
| Apple Developer Program | $99 | Annual |
| Google Play Developer | $25 | One-time |
| EAS Build (beyond free tier) | ~$0-$99/mo | Monthly |
| **Minimum to Launch** | **$124** | First year |

## Current Mobile App Status

The current Expo-based mobile app includes:
- Full authentication flow
- Dashboard with real stats
- Jobs, clients, quotes, invoices management
- Signature capture
- Photo uploads
- Team chat, direct messages
- Dispatch board
- Time tracking
- Calendar views
- Settings and preferences

All these features work without native builds using Expo Go for development.
