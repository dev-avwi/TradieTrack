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
const ALERT_WIDTH = Math.min(SCREEN_WIDTH - 48, 320);

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

  const titleColor = isDark ? '#ffffff' : '#000000';
  const messageColor = isDark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.7)';
  const separatorColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const getButtonStyle = (btn: AlertButton, index: number, total: number) => {
    const isLast = index === total - 1;
    if (btn.style === 'destructive') {
      return {
        text: isDark ? '#ff453a' : '#ff3b30',
        fontWeight: '600' as const,
      };
    }
    if (btn.style === 'cancel') {
      return {
        text: isDark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.5)',
        fontWeight: '400' as const,
      };
    }
    return {
      text: isDark ? '#0a84ff' : '#007aff',
      fontWeight: '600' as const,
    };
  };

  const cardBg = isDark ? 'rgba(44,44,46,0.88)' : 'rgba(255,255,255,0.88)';

  const actionButtons = (
    <View style={styles.actionsContainer}>
      <View style={[styles.separator, { backgroundColor: separatorColor }]} />
      {showButtonsInRow ? (
        <View style={styles.buttonsRow}>
          {orderedButtons.map((btn, i) => {
            const btnStyle = getButtonStyle(btn, i, orderedButtons.length);
            const showVerticalSep = i < orderedButtons.length - 1;
            return (
              <View key={i} style={[styles.btnRowWrapper, i > 0 && styles.btnRowWithSep]}>
                {i > 0 && (
                  <View style={[styles.verticalSeparator, { backgroundColor: separatorColor }]} />
                )}
                <TouchableOpacity
                  style={styles.btnRow}
                  onPress={() => dismiss(btn.onPress || undefined)}
                  activeOpacity={0.4}
                >
                  <Text style={[styles.btnText, { color: btnStyle.text, fontWeight: btnStyle.fontWeight }]}>
                    {btn.text || 'OK'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.buttonsColumn}>
          {orderedButtons.map((btn, i) => {
            const btnStyle = getButtonStyle(btn, i, orderedButtons.length);
            return (
              <View key={i}>
                {i > 0 && (
                  <View style={[styles.separator, { backgroundColor: separatorColor }]} />
                )}
                <TouchableOpacity
                  style={styles.btnColumn}
                  onPress={() => dismiss(btn.onPress || undefined)}
                  activeOpacity={0.4}
                >
                  <Text style={[styles.btnText, { color: btnStyle.text, fontWeight: btnStyle.fontWeight }]}>
                    {btn.text || 'OK'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

  const cardContent = (
    <>
      <View style={styles.contentSection}>
        <Text style={[styles.title, { color: titleColor }]}>{config.title}</Text>
        {config.message ? (
          <Text style={[styles.message, { color: messageColor }]}>{config.message}</Text>
        ) : null}
      </View>
      {actionButtons}
    </>
  );

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={50}
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
            <View style={[styles.cardBase, { backgroundColor: cardBg }]}>
              <LiquidGlassView style={styles.glassOverlay} effect="regular">
                {cardContent}
              </LiquidGlassView>
            </View>
          ) : (
            <View style={[styles.cardBase, { overflow: 'hidden' }]}>
              {Platform.OS === 'ios' ? (
                <BlurView
                  intensity={80}
                  tint={isDark ? 'dark' as const : 'light' as const}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
              <View style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
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
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  cardOuter: {
    width: ALERT_WIDTH,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 40,
      },
      android: {
        elevation: 24,
      },
    }),
  },
  cardBase: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  glassOverlay: {
    width: '100%',
    borderRadius: 16,
  },
  contentSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 22,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  actionsContainer: {
    width: '100%',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  verticalSeparator: {
    width: StyleSheet.hairlineWidth,
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
  },
  buttonsRow: {
    flexDirection: 'row',
    width: '100%',
  },
  btnRowWrapper: {
    flex: 1,
    position: 'relative',
  },
  btnRowWithSep: {},
  btnRow: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonsColumn: {
    width: '100%',
  },
  btnColumn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  btnText: {
    fontSize: 17,
    letterSpacing: -0.2,
  },
});
