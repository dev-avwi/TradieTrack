import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../lib/theme';
import { spacing, radius } from '../../lib/design-tokens';

interface TrustBannerProps {
  businessName?: string;
}

export function TrustBanner({ businessName }: TrustBannerProps) {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Feather name="map-pin" size={20} color={colors.primary} />
          </View>
        </View>
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>TradieTrack</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Free During Beta</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>Built for Australian tradies</Text>
        </View>
      </View>
      
      <View style={styles.features}>
        <View style={styles.featureItem}>
          <Feather name="check-circle" size={14} color={colors.success} />
          <Text style={styles.featureText}>GST compliant</Text>
        </View>
        <View style={styles.featureItem}>
          <Feather name="shield" size={14} color={colors.success} />
          <Text style={styles.featureText}>Secure payments</Text>
        </View>
        <View style={styles.featureItem}>
          <Feather name="lock" size={14} color={colors.success} />
          <Text style={styles.featureText}>Encrypted</Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: {
    backgroundColor: isDark ? colors.infoLight : '#eff6ff',
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: isDark ? colors.info : '#bfdbfe',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logoContainer: {
    marginRight: spacing.md,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.foreground,
  },
  badge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.successForeground,
  },
  subtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  features: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featureText: {
    fontSize: 13,
    color: colors.secondaryText,
  },
});

export default TrustBanner;
