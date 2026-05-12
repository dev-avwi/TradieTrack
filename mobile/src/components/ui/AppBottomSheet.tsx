import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  ReactNode,
} from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {
  BottomSheetScrollView as GorhomBottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTheme } from '../../lib/theme';
import { radius, spacing, shadows, typography } from '../../lib/design-tokens';

export interface AppBottomSheetRef {
  present: () => void;
  dismiss: () => void;
}

export interface AppBottomSheetProps {
  children: ReactNode;
  snapPoints?: (string | number)[];
  enableDynamicSizing?: boolean;
  enablePanDownToClose?: boolean;
  onDismiss?: () => void;
  title?: string;
  showCloseButton?: boolean;
  keyboardBehavior?: 'interactive' | 'extend' | 'fillParent';
  scrollable?: boolean;
  contentPadding?: number;
  /**
   * Optional declarative visibility. When provided, the sheet imperatively
   * presents/dismisses to match this boolean. Existing call-sites can simply
   * swap a native <Modal visible={x}> for <AppBottomSheet visible={x}> with
   * no other changes.
   */
  visible?: boolean;
}

/**
 * Parse a snap point ("85%", 0.85, 600, "600") into a target sheet height
 * in pixels relative to the screen height.
 */
function resolveSheetHeight(
  snapPoints: (string | number)[] | undefined,
  enableDynamicSizing: boolean,
  screenHeight: number,
): number {
  if (snapPoints && snapPoints.length > 0) {
    // Use the LAST (largest) snap point as the visible height — matches
    // gorhom behaviour of opening to the largest snap on present().
    const sp = snapPoints[snapPoints.length - 1];
    if (typeof sp === 'string') {
      const trimmed = sp.trim();
      if (trimmed.endsWith('%')) {
        const pct = parseFloat(trimmed) / 100;
        return Math.round(screenHeight * pct);
      }
      const n = parseFloat(trimmed);
      if (!Number.isNaN(n)) return n;
    } else if (typeof sp === 'number') {
      return sp <= 1 ? Math.round(screenHeight * sp) : sp;
    }
  }
  if (enableDynamicSizing) {
    // Best-effort: cap at 90% so dynamic content never overflows the screen.
    return Math.round(screenHeight * 0.9);
  }
  return Math.round(screenHeight * 0.9);
}

const AppBottomSheet = forwardRef<AppBottomSheetRef, AppBottomSheetProps>(
  (
    {
      children,
      snapPoints,
      enableDynamicSizing = true,
      enablePanDownToClose = true,
      onDismiss,
      title,
      showCloseButton = false,
      keyboardBehavior = 'interactive',
      scrollable = true,
      contentPadding = spacing.lg,
      visible: visibleProp,
    },
    ref,
  ) => {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const [internalVisible, setInternalVisible] = useState(false);
    // Modal stays mounted for the close animation; we drive open/close via
    // `mounted` and animate translate/opacity separately so the slide-out
    // plays before unmount.
    const [mounted, setMounted] = useState(false);
    const screenHeight = Dimensions.get('window').height;
    const sheetHeight = resolveSheetHeight(snapPoints, enableDynamicSizing, screenHeight);
    const translateY = useRef(new Animated.Value(screenHeight)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;

    const isVisible = visibleProp !== undefined ? visibleProp : internalVisible;

    const present = useCallback(() => {
      if (visibleProp === undefined) setInternalVisible(true);
    }, [visibleProp]);

    const dismiss = useCallback(() => {
      if (visibleProp === undefined) setInternalVisible(false);
      // If parent owns visibility, surface intent through onDismiss so they
      // can flip their own state.
      else onDismiss?.();
    }, [visibleProp, onDismiss]);

    useImperativeHandle(ref, () => ({ present, dismiss }), [present, dismiss]);

    // Open / close animation driver.
    useEffect(() => {
      if (isVisible) {
        setMounted(true);
        // Reset position before animating in.
        translateY.setValue(screenHeight);
        backdropOpacity.setValue(0);
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            damping: 22,
            stiffness: 220,
            mass: 0.9,
            useNativeDriver: true,
          }),
        ]).start();
      } else if (mounted) {
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: screenHeight,
            duration: 220,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished) setMounted(false);
        });
      }
    }, [isVisible, screenHeight, translateY, backdropOpacity, mounted]);

    const handleBackdropPress = useCallback(() => {
      if (!enablePanDownToClose) return;
      if (visibleProp === undefined) {
        setInternalVisible(false);
      }
      onDismiss?.();
    }, [enablePanDownToClose, visibleProp, onDismiss]);

    const handleRequestClose = useCallback(() => {
      // Hardware back on Android.
      if (visibleProp === undefined) setInternalVisible(false);
      onDismiss?.();
    }, [visibleProp, onDismiss]);

    if (!mounted) return null;

    const innerContentStyle = {
      paddingHorizontal: contentPadding,
      paddingBottom: contentPadding + Math.max(insets.bottom, 0),
    };

    return (
      <Modal
        visible={mounted}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={handleRequestClose}
        presentationStyle="overFullScreen"
        hardwareAccelerated
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Backdrop */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(0,0,0,0.5)', opacity: backdropOpacity },
            ]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} />
          </Animated.View>

          {/* Sheet */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.kbWrapper}
            pointerEvents="box-none"
          >
            <Animated.View
              style={[
                styles.sheet,
                {
                  height: sheetHeight,
                  backgroundColor: colors.card,
                  transform: [{ translateY }],
                },
                shadows.lg as object,
              ]}
            >
              {/* Drag handle */}
              <View style={styles.handleArea}>
                <View
                  style={[
                    styles.handle,
                    {
                      backgroundColor: isDark
                        ? colors.borderLight
                        : colors.mutedForeground,
                    },
                  ]}
                />
              </View>

              {(title || showCloseButton) && (
                <View
                  style={[
                    styles.header,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      typography.cardTitle,
                      { color: colors.foreground, flex: 1 },
                    ]}
                    numberOfLines={1}
                  >
                    {title || ''}
                  </Text>
                  {showCloseButton ? (
                    <Pressable
                      onPress={() => {
                        if (visibleProp === undefined) setInternalVisible(false);
                        onDismiss?.();
                      }}
                      hitSlop={8}
                      style={styles.closeBtn}
                    >
                      <X size={20} color={colors.mutedForeground} />
                    </Pressable>
                  ) : null}
                </View>
              )}

              {scrollable ? (
                <ScrollView
                  style={{ flex: 1, backgroundColor: colors.card }}
                  contentContainerStyle={innerContentStyle}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {children}
                </ScrollView>
              ) : (
                <View
                  style={[
                    innerContentStyle,
                    { backgroundColor: colors.card, flex: 1 },
                  ]}
                >
                  {children}
                </View>
              )}
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  },
);

AppBottomSheet.displayName = 'AppBottomSheet';

export function useAppBottomSheet() {
  const ref = useRef<AppBottomSheetRef>(null);
  const present = useCallback(() => ref.current?.present(), []);
  const dismiss = useCallback(() => ref.current?.dismiss(), []);
  return { ref, present, dismiss };
}

// Re-export gorhom's BottomSheetScrollView for any call-site that imported it
// from inside a sheet. Inside our native-Modal sheet a regular ScrollView
// works just as well, so we alias to it to avoid pulling gorhom into render
// when the binary doesn't have the right native module wired.
export const BottomSheetScrollView = (props: any) => {
  const { children, contentContainerStyle, style, ...rest } = props;
  return (
    <ScrollView
      {...rest}
      style={style}
      contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
};

// Keep direct gorhom export available for callers that explicitly want it
// (rare). Not used by AppBottomSheet itself.
export { GorhomBottomSheetScrollView };

const styles = StyleSheet.create({
  kbWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },
  handleArea: {
    paddingTop: 10,
    paddingBottom: 6,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export { AppBottomSheet };
export default AppBottomSheet;
