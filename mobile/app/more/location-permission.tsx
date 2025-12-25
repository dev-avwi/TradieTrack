import { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
  Platform
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography } from '../../src/lib/design-tokens';
import { useLocationStore } from '../../src/lib/location-store';

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
    paddingTop: spacing.xl,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.infoLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  heroTitle: {
    ...typography.title,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 24,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  featureList: {
    marginBottom: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.infoLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  featureDescription: {
    ...typography.body,
    color: colors.mutedForeground,
    lineHeight: 22,
  },
  optionalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
    marginBottom: spacing.lg,
  },
  optionalBadgeIcon: {
    marginRight: spacing.xs,
  },
  optionalBadgeText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  paragraph: {
    ...typography.body,
    color: colors.foreground,
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  privacyIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  privacyText: {
    ...typography.body,
    color: colors.mutedForeground,
    flex: 1,
    lineHeight: 22,
  },
  privacyLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: spacing.lg,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  primaryButtonText: {
    ...typography.subtitle,
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  secondaryButtonText: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '600',
  },
  skipButton: {
    padding: spacing.md,
    alignItems: 'center',
  },
  skipButtonText: {
    ...typography.body,
    color: colors.mutedForeground,
  },
  permissionExplainer: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  permissionExplainerTitle: {
    ...typography.subtitle,
    color: colors.warning,
    marginBottom: spacing.xs,
  },
  permissionExplainerText: {
    ...typography.caption,
    color: colors.foreground,
    lineHeight: 20,
  },
});

interface FeatureItemProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}

function FeatureItem({ icon, title, description, colors, styles }: FeatureItemProps) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIcon}>
        <Feather name={icon} size={16} color={colors.info} />
      </View>
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

export default function LocationPermissionScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { enableTracking, permissionGranted } = useLocationStore();
  
  const [isRequesting, setIsRequesting] = useState(false);
  
  const handleEnableLocation = async () => {
    setIsRequesting(true);
    try {
      const success = await enableTracking();
      if (success) {
        router.back();
      }
    } catch (error) {
      console.error('Failed to enable location:', error);
    } finally {
      setIsRequesting(false);
    }
  };
  
  const handleMaybeLater = () => {
    router.back();
  };
  
  const handleSkip = () => {
    router.back();
  };
  
  const navigateToPrivacy = () => {
    router.push('/more/privacy-policy');
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Location Permission',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
        }} 
      />
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <View style={styles.heroIcon}>
            <Feather name="map-pin" size={36} color={colors.info} />
          </View>
          <Text style={styles.heroTitle}>Enable Location Services</Text>
          <Text style={styles.heroSubtitle}>
            Get the most out of TradieTrack with intelligent location features
          </Text>
        </View>
        
        <View style={styles.optionalBadge}>
          <Feather 
            name="check-circle" 
            size={14} 
            color={colors.success} 
            style={styles.optionalBadgeIcon}
          />
          <Text style={styles.optionalBadgeText}>Optional - You can disable anytime</Text>
        </View>
        
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Why We Need Location Access</Text>
          <View style={styles.featureList}>
            <FeatureItem 
              icon="users"
              title="Team Tracking"
              description="See where your team members are in real-time to coordinate jobs efficiently."
              colors={colors}
              styles={styles}
            />
            <FeatureItem 
              icon="zap"
              title="Automatic Clock-In"
              description="Geofence auto clock-in when you arrive at job sites - no more forgetting to start the timer."
              colors={colors}
              styles={styles}
            />
            <FeatureItem 
              icon="navigation"
              title="Live ETA for Clients"
              description="Share your live arrival time with clients so they know exactly when to expect you."
              colors={colors}
              styles={styles}
            />
            <FeatureItem 
              icon="map"
              title="Route Optimization"
              description="Get smart route suggestions to minimize travel time between jobs."
              colors={colors}
              styles={styles}
            />
          </View>
        </View>
        
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your Privacy Matters</Text>
          <Text style={styles.paragraph}>
            Your location data is only used for the features above and is never sold or shared with third parties.
          </Text>
          
          <View style={styles.privacyNote}>
            <Feather 
              name="shield" 
              size={16} 
              color={colors.mutedForeground} 
              style={styles.privacyIcon}
            />
            <Text style={styles.privacyText}>
              Location tracking can be disabled at any time from Settings. 
              Read our{' '}
              <Text style={styles.privacyLink} onPress={navigateToPrivacy}>
                Privacy Policy
              </Text>
              {' '}for more details.
            </Text>
          </View>
          
          {Platform.OS === 'ios' && (
            <View style={styles.permissionExplainer}>
              <Text style={styles.permissionExplainerTitle}>
                About "Always Allow" Permission
              </Text>
              <Text style={styles.permissionExplainerText}>
                For automatic clock-in and team tracking to work when the app is in the background, 
                iOS requires "Always Allow" location permission. You can change this setting at any 
                time in your device's Settings app.
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleEnableLocation}
            disabled={isRequesting}
            activeOpacity={0.8}
            testID="button-enable-location"
          >
            {isRequesting ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Enable Location</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleMaybeLater}
            disabled={isRequesting}
            testID="button-maybe-later"
          >
            <Text style={styles.secondaryButtonText}>Maybe Later</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            disabled={isRequesting}
            testID="button-skip-location"
          >
            <Text style={styles.skipButtonText}>Skip for Now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}
