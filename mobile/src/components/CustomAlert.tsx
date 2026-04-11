import { useEffect, useRef, useState, createContext, useContext, useCallback, ReactNode } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Alert as RNAlert,
  AlertButton,
  AlertOptions,
  useColorScheme,
} from 'react-native';
import { BlurView } from 'expo-blur';
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';

interface AlertConfig {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  options?: AlertOptions;
}

interface CustomAlertContextType {
  showAlert: (title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) => void;
}

const CustomAlertContext = createContext<CustomAlertContextType | null>(null);

export function useCustomAlert() {
  const ctx = useContext(CustomAlertContext);
  if (!ctx) throw new Error('useCustomAlert must be used within CustomAlertProvider');
  return ctx;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ALERT_WIDTH = Math.min(SCREEN_WIDTH - 64, 300);

function AlertModal({ config, onDismiss }: { config: AlertConfig; onDismiss: () => void }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1.06)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 9,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const dismiss = useCallback((callback?: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.96,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
      if (callback) callback();
    });
  }, [fadeAnim, scaleAnim, onDismiss]);

  const buttons = config.buttons && config.buttons.length > 0
    ? config.buttons
    : [{ text: 'OK', style: 'default' as const }];

  const cancelIndex = buttons.findIndex(b => b.style === 'cancel');
  const nonCancelButtons = buttons.filter(b => b.style !== 'cancel');
  const cancelButton = cancelIndex >= 0 ? buttons[cancelIndex] : null;
  const orderedButtons = cancelButton
    ? [...nonCancelButtons, cancelButton]
    : nonCancelButtons;

  const showButtonsInRow = orderedButtons.length <= 2;

  const titleColor = isDark ? '#ffffff' : '#1a1a1a';
  const messageColor = isDark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.6)';

  const getButtonStyle = (btn: AlertButton) => {
    if (btn.style === 'destructive') {
      return {
        bg: isDark ? 'rgba(255,69,58,0.12)' : 'rgba(255,59,48,0.06)',
        text: isDark ? '#ff453a' : '#ff3b30',
        fontWeight: '600' as const,
      };
    }
    if (btn.style === 'cancel') {
      return {
        bg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(120,120,128,0.06)',
        text: isDark ? 'rgba(235,235,245,0.45)' : 'rgba(60,60,67,0.45)',
        fontWeight: '500' as const,
      };
    }
    return {
      bg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(120,120,128,0.08)',
      text: isDark ? '#ffffff' : '#1a1a1a',
      fontWeight: '600' as const,
    };
  };

  const cardContent = (
    <View style={styles.cardInner}>
      <View style={styles.contentSection}>
        <Text style={[styles.title, { color: titleColor }]}>{config.title}</Text>
        {config.message ? (
          <Text style={[styles.message, { color: messageColor }]}>{config.message}</Text>
        ) : null}
      </View>

      <View style={showButtonsInRow ? styles.buttonsRow : styles.buttonsColumn}>
        {orderedButtons.map((btn, i) => {
          const btnStyle = getButtonStyle(btn);
          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.btn,
                showButtonsInRow && styles.btnFlex,
                { backgroundColor: btnStyle.bg },
              ]}
              onPress={() => dismiss(btn.onPress || undefined)}
              activeOpacity={0.5}
            >
              <Text style={[styles.btnText, { color: btnStyle.text, fontWeight: btnStyle.fontWeight }]}>
                {btn.text || 'OK'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={70}
            tint={isDark ? 'dark' as const : 'default' as const}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={styles.overlayDim} />

        <Animated.View
          style={[
            styles.cardOuter,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {isLiquidGlassSupported ? (
            <LiquidGlassView style={styles.glassCard} effect="regular">
              {cardContent}
            </LiquidGlassView>
          ) : (
            <View style={styles.fallbackCard}>
              {Platform.OS === 'ios' ? (
                <BlurView
                  intensity={90}
                  tint={isDark ? 'dark' as const : 'light' as const}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: isDark ? 'rgba(38,38,40,0.85)' : 'rgba(255,255,255,0.85)' },
                ]}
              />
              {cardContent}
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

let globalShowAlert: ((title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) => void) | null = null;

const originalAlert = RNAlert.alert.bind(RNAlert);

function patchedAlert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
  if (globalShowAlert) {
    globalShowAlert(title, message, buttons, options);
  } else {
    originalAlert(title, message, buttons, options);
  }
}

RNAlert.alert = patchedAlert;

export function CustomAlertProvider({ children }: { children: ReactNode }) {
  const [alertQueue, setAlertQueue] = useState<AlertConfig[]>([]);

  const showAlert = useCallback((title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) => {
    setAlertQueue(prev => [...prev, { title, message, buttons, options }]);
  }, []);

  useEffect(() => {
    globalShowAlert = showAlert;
    RNAlert.alert = patchedAlert;
    return () => {
      globalShowAlert = null;
    };
  }, [showAlert]);

  const dismissCurrent = useCallback(() => {
    setAlertQueue(prev => prev.slice(1));
  }, []);

  const currentAlert = alertQueue.length > 0 ? alertQueue[0] : null;

  return (
    <CustomAlertContext.Provider value={{ showAlert }}>
      {children}
      {currentAlert && (
        <AlertModal config={currentAlert} onDismiss={dismissCurrent} />
      )}
    </CustomAlertContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  cardOuter: {
    width: ALERT_WIDTH,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.10,
        shadowRadius: 48,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  glassCard: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  fallbackCard: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardInner: {
    width: '100%',
  },
  contentSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 21,
  },
  message: {
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
    letterSpacing: -0.05,
  },
  buttonsRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
  },
  buttonsColumn: {
    flexDirection: 'column',
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 6,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  btnFlex: {
    flex: 1,
  },
  btnText: {
    fontSize: 15,
    letterSpacing: -0.15,
  },
});
