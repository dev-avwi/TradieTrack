import { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTheme, ThemeColors } from '../../lib/theme';
import { useAuthStore } from '../../lib/store';
import { spacing } from '../../lib/design-tokens';

const TRADIE_TRACK_LOGO = require('../../../assets/tradietrack-logo.png');

interface LoadingScreenProps {
  message?: string;
  showProgress?: boolean;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  tradieTrackLogo: {
    width: 100,
    height: 100,
  },
  businessLogo: {
    width: 92,
    height: 92,
    borderRadius: 20,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  appName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: -0.3,
    marginBottom: spacing.xs,
  },
  message: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  progressContainer: {
    marginTop: spacing['2xl'],
    width: 160,
    height: 3,
    backgroundColor: colors.muted,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 1.5,
  },
  shimmerContainer: {
    marginTop: spacing.xl,
    width: 140,
    height: 3,
    backgroundColor: colors.muted,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  shimmer: {
    width: 70,
    height: '100%',
    borderRadius: 1.5,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
});

function LoadingDots({ colors }: { colors: ThemeColors }) {
  const dot1Opacity = useRef(new Animated.Value(0.3)).current;
  const dot2Opacity = useRef(new Animated.Value(0.3)).current;
  const dot3Opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
    };

    const anim1 = animateDot(dot1Opacity, 0);
    const anim2 = animateDot(dot2Opacity, 200);
    const anim3 = animateDot(dot3Opacity, 400);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, []);

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.dotsContainer}>
      <Animated.View style={[styles.dot, { opacity: dot1Opacity }]} />
      <Animated.View style={[styles.dot, { opacity: dot2Opacity }]} />
      <Animated.View style={[styles.dot, { opacity: dot3Opacity }]} />
    </View>
  );
}

function PulsingLogo({ 
  colors, 
  businessLogoUrl,
}: { 
  colors: ThemeColors; 
  businessLogoUrl?: string;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1.02,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.9,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Animated.View
      style={[
        styles.logoContainer,
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      {businessLogoUrl ? (
        <Image 
          source={{ uri: businessLogoUrl }} 
          style={styles.businessLogo}
          resizeMode="cover"
        />
      ) : (
        <Image 
          source={TRADIE_TRACK_LOGO} 
          style={styles.tradieTrackLogo}
          resizeMode="contain"
        />
      )}
    </Animated.View>
  );
}

export function LoadingScreen({ message, showProgress = false }: LoadingScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { businessSettings } = useAuthStore();
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showProgress) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(progressAnim, {
            toValue: 0.85,
            duration: 1800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
          Animated.timing(progressAnim, {
            toValue: 0.95,
            duration: 1500,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
          Animated.delay(300),
          Animated.timing(progressAnim, {
            toValue: 0,
            duration: 200,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
        ])
      ).start();
    }
  }, [showProgress]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const businessLogoUrl = businessSettings?.logoUrl;
  const { isDark } = useTheme();

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.background} />
      <View style={styles.contentWrapper}>
        <PulsingLogo 
          colors={colors} 
          businessLogoUrl={businessLogoUrl}
        />

        <View style={styles.textContainer}>
          <Text style={styles.appName}>TradieTrack</Text>
          {message && <Text style={styles.message}>{message}</Text>}
        </View>

        {showProgress ? (
          <View style={styles.progressContainer}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
        ) : (
          <LoadingDots colors={colors} />
        )}
      </View>
    </View>
  );
}

export function LoadingOverlay({ 
  visible = true, 
  message = 'Loading...',
  transparent = true 
}: { 
  visible?: boolean;
  message?: string;
  transparent?: boolean;
}) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: visible ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: visible ? 1 : 0.95,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible]);

  if (!visible) return null;

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Animated.View
      style={{
        ...StyleSheet.absoluteFillObject,
        backgroundColor: transparent ? `${colors.background}F2` : colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadeAnim,
      }}
    >
      <Animated.View
        style={{
          alignItems: 'center',
          transform: [{ scale: scaleAnim }],
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            backgroundColor: colors.card,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.md,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.cardBorder,
          }}
        >
          <Image 
            source={TRADIE_TRACK_LOGO} 
            style={{ width: 56, height: 56 }}
            resizeMode="contain"
          />
        </View>
        <Text
          style={{
            fontSize: 14,
            color: colors.foreground,
            fontWeight: '500',
          }}
        >
          {message}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}
