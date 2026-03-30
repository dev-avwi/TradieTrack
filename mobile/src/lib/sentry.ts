import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (__DEV__ || !SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 0.2,
    attachScreenshot: true,
    enableNativeFramesTracking: true,
    release: `com.jobrunner.app@${Constants.expoConfig?.version ?? '1.0.0'}`,
    dist: Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode?.toString() ?? '1',
  });
}

export function setSentryUser(user: { id: string; email?: string; firstName?: string; lastName?: string } | null) {
  if (__DEV__ || !SENTRY_DSN) return;

  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
    });
  } else {
    Sentry.setUser(null);
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (__DEV__) {
    console.error('[Sentry] Would capture:', error);
    return;
  }
  if (!SENTRY_DSN) return;

  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

export { Sentry };
