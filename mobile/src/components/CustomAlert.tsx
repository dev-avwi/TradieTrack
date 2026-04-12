import { useEffect, useRef, useState, createContext, useContext, useCallback, ReactNode } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
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
const ALERT_WIDTH = Math.min(SCREEN_WIDTH - 56, 300);

function AlertModal({ config, onDismiss }: { config: AlertConfig; onDismiss: () => void }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1.08)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 10,
        tension: 140,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const dismiss = useCallback((callback?: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 140,
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

  const titleColor = isDark ? '#f5f5f7' : '#1c1c1e';
  const messageColor = isDark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)';

  const getButtonStyle = (btn: AlertButton) => {
    if (btn.style === 'destructive') {
      return {
        bg: isDark ? 'rgba(255,69,58,0.15)' : 'rgba(255,59,48,0.08)',
        text: '#ff3b30',
        fontWeight: '600' as const,
      };
    }
    if (btn.style === 'cancel') {
      return {
        bg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(120,120,128,0.08)',
        text: isDark ? 'rgba(235,235,245,0.5)' : 'rgba(60,60,67,0.5)',
        fontWeight: '600' as const,
      };
    }
    return {
      bg: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.04)',
      text: isDark ? '#f5f5f7' : '#1c1c1e',
      fontWeight: '600' as const,
    };
  };

  const alertContent = (
    <>
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
            <Pressable
              key={i}
              style={({ pressed }) => [
                styles.btn,
                showButtonsInRow && styles.btnFlex,
                { backgroundColor: btnStyle.bg },
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => dismiss(btn.onPress || undefined)}
            >
              <Text style={[styles.btnText, { color: btnStyle.text, fontWeight: btnStyle.fontWeight }]}>
                {btn.text || 'OK'}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );

  const cardBg = isDark ? 'rgba(44,44,46,0.85)' : 'rgba(255,255,255,0.92)';

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent>
      <Pressable style={styles.overlayTouch} onPress={() => dismiss()}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={40}
              tint={isDark ? 'dark' : 'default'}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View style={styles.overlayDim} />
        </Animated.View>
      </Pressable>

      <View style={styles.centerContainer} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.cardPosition,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {isLiquidGlassSupported ? (
            <LiquidGlassView style={styles.glassCard} effect="regular">
              {alertContent}
            </LiquidGlassView>
          ) : (
            <View style={[styles.fallbackCard, { backgroundColor: cardBg }]}>
              {Platform.OS === 'ios' ? (
                <BlurView
                  tint={isDark ? 'systemThickMaterialDark' as any : 'systemThickMaterial' as any}
                  intensity={100}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
              {alertContent}
            </View>
          )}
        </Animated.View>
      </View>
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
  overlayTouch: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  overlay: {
    flex: 1,
  },
  overlayDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  centerContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  cardPosition: {
    width: ALERT_WIDTH,
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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
    }),
  },
  contentSection: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  message: {
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
    letterSpacing: -0.05,
  },
  buttonsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  buttonsColumn: {
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  btn: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  btnFlex: {
    flex: 1,
  },
  btnText: {
    fontSize: 16,
    letterSpacing: -0.2,
  },
});
