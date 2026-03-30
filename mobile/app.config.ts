import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name || 'JobRunner',
  slug: config.slug || 'jobrunner',
  plugins: [
    ...(config.plugins || []),
    [
      '@sentry/react-native/expo',
      {
        organization: process.env.SENTRY_ORG || 'jobrunner',
        project: process.env.SENTRY_PROJECT || 'jobrunner-mobile',
      },
    ],
  ],
  extra: {
    ...config.extra,
    apiUrl: process.env.EXPO_PUBLIC_API_URL || config.extra?.apiUrl,
  },
});
