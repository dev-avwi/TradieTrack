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
const ALERT_WIDTH = Math.min(SCREEN_WIDTH - 60, 310);

function AlertModal({ config, onDismiss }: { config: AlertConfig; onDismiss: () => void }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1.05)).current;

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
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.95,
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

  const isVerticalLayout = buttons.length > 2;
  const cancelIndex = buttons.findIndex(b => b.style === 'cancel');

  const sortedButtons = isVerticalLayout
    ? [...buttons].sort((a, b) => {
        if (a.style === 'cancel') return 1;
        if (b.style === 'cancel') return -1;
        return 0;
      })
    : cancelIndex === -1
      ? buttons
      : (() => {
          const reordered = [...buttons];
          const [cancelBtn] = reordered.splice(cancelIndex, 1);
          reordered.unshift(cancelBtn);
          return reordered;
        })();

  const textColor = isDark ? '#fff' : '#000';
  const dividerColor = isDark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.29)';
  const blurTint = isDark ? 'systemThickMaterialDark' as const : 'systemThickMaterialLight' as const;
  const androidBg = isDark ? '#2c2c2e' : '#fff';

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
            <BlurView intensity={95} tint={blurTint} style={styles.blurContainer}>
              <AlertContent
                config={config}
                buttons={sortedButtons}
                isVerticalLayout={isVerticalLayout}
                dismiss={dismiss}
                textColor={textColor}
                dividerColor={dividerColor}
              />
            </BlurView>
          ) : (
            <View style={[styles.androidContainer, { backgroundColor: androidBg }]}>
              <AlertContent
                config={config}
                buttons={sortedButtons}
                isVerticalLayout={isVerticalLayout}
                dismiss={dismiss}
                textColor={textColor}
                dividerColor={dividerColor}
              />
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function AlertContent({
  config,
  buttons,
  isVerticalLayout,
  dismiss,
  textColor,
  dividerColor,
}: {
  config: AlertConfig;
  buttons: AlertButton[];
  isVerticalLayout: boolean;
  dismiss: (callback?: () => void) => void;
  textColor: string;
  dividerColor: string;
}) {
  return (
    <>
      <View style={styles.contentSection}>
        <Text style={[styles.title, { color: textColor }]}>{config.title}</Text>
        {config.message ? (
          <Text style={[styles.message, { color: textColor }]}>{config.message}</Text>
        ) : null}
      </View>
      <View style={[styles.divider, { backgroundColor: dividerColor }]} />
      <View style={isVerticalLayout ? styles.buttonsVertical : styles.buttonsHorizontal}>
        {buttons.map((btn, i) => {
          const isCancel = btn.style === 'cancel';
          const isDestructive = btn.style === 'destructive';
          const isLast = i === buttons.length - 1;
          const showDivider = !isLast;

          return (
            <View key={i} style={isVerticalLayout ? styles.buttonVerticalWrap : { flex: 1, flexDirection: 'row' as const }}>
              <TouchableOpacity
                style={[
                  styles.button,
                  isVerticalLayout ? styles.buttonVertical : styles.buttonHorizontal,
                ]}
                onPress={() => dismiss(btn.onPress || undefined)}
                activeOpacity={0.6}
              >
                <Text
                  style={[
                    styles.buttonText,
                    isCancel && styles.buttonTextCancel,
                    isDestructive && styles.buttonTextDestructive,
                    !isCancel && !isDestructive && buttons.length <= 2 && i === buttons.length - 1 && styles.buttonTextBold,
                  ]}
                >
                  {btn.text || 'OK'}
                </Text>
              </TouchableOpacity>
              {showDivider && (
                <View style={isVerticalLayout
                  ? [styles.divider, { backgroundColor: dividerColor }]
                  : [styles.dividerVertical, { backgroundColor: dividerColor }]
                } />
              )}
            </View>
          );
        })}
      </View>
    </>
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
      RNAlert.alert = originalAlert;
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
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  alertContainer: {
    width: ALERT_WIDTH,
    borderRadius: 14,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 24,
      },
    }),
  },
  blurContainer: {
    overflow: 'hidden',
    borderRadius: 14,
  },
  androidContainer: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  contentSection: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  message: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  dividerVertical: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  buttonsHorizontal: {
    flexDirection: 'row',
  },
  buttonsVertical: {
    flexDirection: 'column',
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  buttonHorizontal: {
    flex: 1,
    paddingHorizontal: 8,
  },
  buttonVertical: {
    width: '100%',
    paddingHorizontal: 8,
  },
  buttonVerticalWrap: {
    width: '100%',
  },
  buttonText: {
    fontSize: 17,
    color: '#007AFF',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  buttonTextBold: {
    fontWeight: '600',
  },
  buttonTextCancel: {
    fontWeight: '600',
    color: '#007AFF',
  },
  buttonTextDestructive: {
    color: '#FF3B30',
    fontWeight: '400',
  },
});
