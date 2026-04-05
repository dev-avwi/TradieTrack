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
const ALERT_WIDTH = Math.min(SCREEN_WIDTH - 48, 340);

function getButtonColors(btn: AlertButton, isDark: boolean) {
  if (btn.style === 'cancel') {
    return {
      bg: isDark ? '#3a3a3c' : '#e5e5ea',
      text: isDark ? '#ffffff' : '#1c1c1e',
    };
  }
  if (btn.style === 'destructive') {
    return {
      bg: isDark ? '#ff453a' : '#ff3b30',
      text: '#ffffff',
    };
  }
  return {
    bg: isDark ? '#ffffff' : '#1c1c1e',
    text: isDark ? '#000000' : '#ffffff',
  };
}

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
        friction: 8,
        tension: 100,
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

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const titleColor = isDark ? '#ffffff' : '#000000';
  const messageColor = isDark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.8)';

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={30}
            tint={isDark ? 'dark' as const : 'default' as const}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={styles.overlayDim} />

        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: cardBg,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.contentSection}>
            <Text style={[styles.title, { color: titleColor }]}>{config.title}</Text>
            {config.message ? (
              <Text style={[styles.message, { color: messageColor }]}>{config.message}</Text>
            ) : null}
          </View>

          <View style={showButtonsInRow ? styles.buttonsRow : styles.buttonsColumn}>
            {orderedButtons.map((btn, i) => {
              const colors = getButtonColors(btn, isDark);
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.btn,
                    showButtonsInRow && styles.btnFlex,
                    { backgroundColor: colors.bg },
                  ]}
                  onPress={() => dismiss(btn.onPress || undefined)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.btnText, { color: colors.text }]}>
                    {btn.text || 'OK'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
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
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  card: {
    width: ALERT_WIDTH,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.2,
        shadowRadius: 48,
      },
      android: {
        elevation: 24,
      },
    }),
  },
  contentSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  message: {
    fontSize: 15,
    marginTop: 8,
    lineHeight: 21,
    letterSpacing: -0.1,
  },
  buttonsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  buttonsColumn: {
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  btnFlex: {
    flex: 1,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
