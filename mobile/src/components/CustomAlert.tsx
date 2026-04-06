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
const ALERT_WIDTH = Math.min(SCREEN_WIDTH - 56, 320);

function AlertModal({ config, onDismiss }: { config: AlertConfig; onDismiss: () => void }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1.1)).current;

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
      if (callback) setTimeout(callback, 10);
    });
  }, [fadeAnim, scaleAnim, onDismiss]);

  const allButtons = config.buttons && config.buttons.length > 0
    ? config.buttons
    : [{ text: 'OK', style: 'default' as const }];

  const cancelBtn = allButtons.find(b => b.style === 'cancel');
  const actionButtons = allButtons.filter(b => b.style !== 'cancel');

  const hasMultipleActions = actionButtons.length > 2;

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const titleColor = isDark ? '#ffffff' : '#000000';
  const messageColor = isDark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.8)';
  const rowBorderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const defaultBtnBg = isDark ? '#3a3a3c' : '#e8e8ed';
  const defaultBtnText = isDark ? '#ffffff' : '#1c1c1e';
  const destructiveBtnBg = isDark ? '#3a2020' : '#ffeaea';
  const destructiveBtnText = isDark ? '#ff6961' : '#d70015';
  const rowTextColor = isDark ? '#ffffff' : '#1c1c1e';

  if (hasMultipleActions) {
    return (
      <Modal transparent visible animationType="none" statusBarTranslucent>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
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

            <View style={[styles.rowDivider, { backgroundColor: rowBorderColor }]} />

            <ScrollView style={styles.rowList} bounces={false}>
              {actionButtons.map((btn, i) => {
                const isDestructive = btn.style === 'destructive';
                return (
                  <View key={i}>
                    <TouchableOpacity
                      style={styles.rowButton}
                      onPress={() => dismiss(btn.onPress || undefined)}
                      activeOpacity={0.5}
                    >
                      <Text style={[
                        styles.rowButtonText,
                        { color: isDestructive ? destructiveBtnText : rowTextColor },
                        isDestructive && { fontWeight: '500' },
                      ]}>
                        {btn.text || 'OK'}
                      </Text>
                    </TouchableOpacity>
                    {i < actionButtons.length - 1 && (
                      <View style={[styles.rowDivider, { backgroundColor: rowBorderColor }]} />
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {cancelBtn && (
              <View style={styles.cancelSection}>
                <TouchableOpacity
                  style={[styles.pillButton, styles.cancelPill, { backgroundColor: defaultBtnBg }]}
                  onPress={() => dismiss(cancelBtn.onPress || undefined)}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.pillButtonText, { color: defaultBtnText }]}>
                    {cancelBtn.text || 'Cancel'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      </Modal>
    );
  }

  const pillButtons = cancelBtn
    ? [cancelBtn, ...actionButtons]
    : actionButtons;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
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

          <View style={styles.pillRow}>
            {pillButtons.map((btn, i) => {
              const isDestructive = btn.style === 'destructive';
              const bgColor = isDestructive ? destructiveBtnBg : defaultBtnBg;
              const txtColor = isDestructive ? destructiveBtnText : defaultBtnText;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.pillButton, styles.pillButtonFlex, { backgroundColor: bgColor }]}
                  onPress={() => dismiss(btn.onPress || undefined)}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.pillButtonText, { color: txtColor }]}>
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
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  card: {
    width: ALERT_WIDTH,
    borderRadius: 14,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
      },
      android: {
        elevation: 24,
      },
    }),
  },
  contentSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  message: {
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  pillRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  pillButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  pillButtonFlex: {
    flex: 1,
  },
  pillButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
  },
  rowList: {
    maxHeight: 280,
  },
  rowButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  rowButtonText: {
    fontSize: 16,
    letterSpacing: -0.1,
  },
  cancelSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  cancelPill: {
    width: '100%',
  },
});
