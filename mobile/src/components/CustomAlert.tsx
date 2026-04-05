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

const BUTTON_COLORS = {
  default: '#1c1c1e',
  cancel: '#8e8e93',
  destructive: '#ff3b30',
  primary: '#2563eb',
  success: '#22c55e',
};

function getButtonStyle(btn: AlertButton, index: number, total: number, isDark: boolean) {
  const isCancel = btn.style === 'cancel';
  const isDestructive = btn.style === 'destructive';

  if (isCancel) {
    return {
      bg: isDark ? '#3a3a3c' : '#f2f2f7',
      text: isDark ? '#ffffff' : '#1c1c1e',
    };
  }
  if (isDestructive) {
    return {
      bg: isDark ? '#ff453a' : BUTTON_COLORS.destructive,
      text: '#ffffff',
    };
  }
  return {
    bg: isDark ? '#ffffff' : BUTTON_COLORS.default,
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
        duration: 180,
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
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 120,
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

  const blurTint = isDark ? 'systemThickMaterialDark' as const : 'systemThickMaterialLight' as const;
  const cardBg = isDark ? 'rgba(44,44,46,0.92)' : 'rgba(255,255,255,0.92)';
  const titleColor = isDark ? '#ffffff' : '#1c1c1e';
  const messageColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(60,60,67,0.85)';

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <View style={styles.overlayBackground} />
        <Animated.View
          style={[
            styles.alertContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {Platform.OS === 'ios' ? (
            <BlurView intensity={80} tint={blurTint} style={styles.blurWrap}>
              <View style={[styles.cardOverlay, { backgroundColor: cardBg }]}>
                <View style={styles.contentSection}>
                  <Text style={[styles.title, { color: titleColor }]}>{config.title}</Text>
                  {config.message ? (
                    <Text style={[styles.message, { color: messageColor }]}>{config.message}</Text>
                  ) : null}
                </View>

                <View style={showButtonsInRow ? styles.buttonsRow : styles.buttonsColumn}>
                  {orderedButtons.map((btn, i) => {
                    const btnStyle = getButtonStyle(btn, i, orderedButtons.length, isDark);
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.filledButton,
                          showButtonsInRow && styles.filledButtonFlex,
                          { backgroundColor: btnStyle.bg },
                        ]}
                        onPress={() => dismiss(btn.onPress || undefined)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.filledButtonText, { color: btnStyle.text }]}>
                          {btn.text || 'OK'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </BlurView>
          ) : (
            <View style={[styles.cardOverlay, { backgroundColor: isDark ? '#2c2c2e' : '#ffffff' }]}>
              <View style={styles.contentSection}>
                <Text style={[styles.title, { color: titleColor }]}>{config.title}</Text>
                {config.message ? (
                  <Text style={[styles.message, { color: messageColor }]}>{config.message}</Text>
                ) : null}
              </View>

              <View style={showButtonsInRow ? styles.buttonsRow : styles.buttonsColumn}>
                {orderedButtons.map((btn, i) => {
                  const btnStyle = getButtonStyle(btn, i, orderedButtons.length, isDark);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.filledButton,
                        showButtonsInRow && styles.filledButtonFlex,
                        { backgroundColor: btnStyle.bg },
                      ]}
                      onPress={() => dismiss(btn.onPress || undefined)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.filledButtonText, { color: btnStyle.text }]}>
                        {btn.text || 'OK'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
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
  overlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  alertContainer: {
    width: ALERT_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 30,
      },
      android: {
        elevation: 24,
      },
    }),
  },
  blurWrap: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  cardOverlay: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  contentSection: {
    paddingHorizontal: 22,
    paddingTop: 22,
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
    marginTop: 6,
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
  filledButton: {
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  filledButtonFlex: {
    flex: 1,
  },
  filledButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
