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
  ScrollView,
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

function AlertModal({ config, onDismiss }: { config: AlertConfig; onDismiss: () => void }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: 22,
        stiffness: 300,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        damping: 22,
        stiffness: 300,
        mass: 0.8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const dismiss = useCallback((callback?: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
      if (callback) setTimeout(callback, 10);
    });
  }, [fadeAnim, scaleAnim, onDismiss]);

  const allButtons = config.buttons && config.buttons.length > 0
    ? config.buttons
    : [{ text: 'OK', style: 'default' as const }];

  const cancelBtn = allButtons.find(b => b.style === 'cancel');
  const actionButtons = allButtons.filter(b => b.style !== 'cancel');
  const hasMultipleActions = actionButtons.length > 2;

  const titleColor = isDark ? '#f5f5f7' : '#1d1d1f';
  const messageColor = isDark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.7)';
  const separatorColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const accentColor = isDark ? '#0A84FF' : '#007AFF';
  const destructiveColor = isDark ? '#FF453A' : '#FF3B30';
  const cancelTextColor = isDark ? '#f5f5f7' : '#1d1d1f';

  const renderButton = (btn: AlertButton, index: number, isLast: boolean, isSingleAction: boolean) => {
    const isDestructive = btn.style === 'destructive';
    const isCancel = btn.style === 'cancel';
    const textColor = isDestructive ? destructiveColor : isCancel ? cancelTextColor : accentColor;
    const fontWeight = isCancel ? '400' as const : '600' as const;

    return (
      <View key={index}>
        <TouchableOpacity
          style={styles.glassButton}
          onPress={() => dismiss(btn.onPress || undefined)}
          activeOpacity={0.4}
        >
          <Text style={[
            styles.glassButtonText,
            { color: textColor, fontWeight },
          ]}>
            {btn.text || 'OK'}
          </Text>
        </TouchableOpacity>
        {!isLast && <View style={[styles.separator, { backgroundColor: separatorColor }]} />}
      </View>
    );
  };

  const orderedButtons = cancelBtn
    ? [...actionButtons, cancelBtn]
    : actionButtons;

  const hasTwoSideBySide = orderedButtons.length === 2 && !hasMultipleActions;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.overlayDim}
          activeOpacity={1}
          onPress={() => {
            if (config.options?.cancelable !== false && cancelBtn) {
              dismiss(cancelBtn.onPress || undefined);
            }
          }}
        />
        <Animated.View
          style={[
            styles.glassCard,
            {
              width: ALERT_WIDTH,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }, { translateY }],
            },
          ]}
        >
          <BlurView
            intensity={isDark ? 60 : 80}
            tint={isDark ? 'dark' : 'light'}
            style={styles.blurFill}
          >
            <View style={[
              styles.glassOverlay,
              { backgroundColor: isDark ? 'rgba(44,44,46,0.72)' : 'rgba(255,255,255,0.78)' },
            ]}>
              <View style={styles.contentSection}>
                <Text style={[styles.title, { color: titleColor }]}>{config.title}</Text>
                {config.message ? (
                  <Text style={[styles.message, { color: messageColor }]}>{config.message}</Text>
                ) : null}
              </View>

              <View style={[styles.separator, { backgroundColor: separatorColor }]} />

              {hasTwoSideBySide ? (
                <View style={styles.sideBySideRow}>
                  <TouchableOpacity
                    style={styles.sideBySideButton}
                    onPress={() => dismiss(orderedButtons[1]?.onPress || undefined)}
                    activeOpacity={0.4}
                  >
                    <Text style={[
                      styles.glassButtonText,
                      {
                        color: orderedButtons[1]?.style === 'destructive' ? destructiveColor
                          : orderedButtons[1]?.style === 'cancel' ? cancelTextColor
                          : accentColor,
                        fontWeight: orderedButtons[1]?.style === 'cancel' ? '400' : '600',
                      },
                    ]}>
                      {orderedButtons[1]?.text || 'Cancel'}
                    </Text>
                  </TouchableOpacity>
                  <View style={[styles.verticalSeparator, { backgroundColor: separatorColor }]} />
                  <TouchableOpacity
                    style={styles.sideBySideButton}
                    onPress={() => dismiss(orderedButtons[0]?.onPress || undefined)}
                    activeOpacity={0.4}
                  >
                    <Text style={[
                      styles.glassButtonText,
                      {
                        color: orderedButtons[0]?.style === 'destructive' ? destructiveColor : accentColor,
                        fontWeight: '600',
                      },
                    ]}>
                      {orderedButtons[0]?.text || 'OK'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : hasMultipleActions ? (
                <ScrollView style={styles.buttonList} bounces={false}>
                  {orderedButtons.map((btn, i) =>
                    renderButton(btn, i, i === orderedButtons.length - 1, false)
                  )}
                </ScrollView>
              ) : (
                orderedButtons.map((btn, i) =>
                  renderButton(btn, i, i === orderedButtons.length - 1, orderedButtons.length === 1)
                )
              )}
            </View>
          </BlurView>
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
  glassCard: {
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 32,
      },
      android: {
        elevation: 28,
      },
    }),
  },
  blurFill: {
    overflow: 'hidden',
    borderRadius: 20,
  },
  glassOverlay: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  contentSection: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 22,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
    letterSpacing: -0.05,
    textAlign: 'center',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  verticalSeparator: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  glassButton: {
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  glassButtonText: {
    fontSize: 17,
    letterSpacing: -0.2,
  },
  sideBySideRow: {
    flexDirection: 'row',
    minHeight: 46,
  },
  sideBySideButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 8,
    minHeight: 46,
  },
  buttonList: {
    maxHeight: 280,
  },
});
