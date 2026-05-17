import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
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
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ScrollViewProps,
  FlatList,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTheme } from '../../lib/theme';
import { radius, spacing, typography } from '../../lib/design-tokens';

export interface AppBottomSheetRef {
  present: () => void;
  dismiss: () => void;
}

export interface AppBottomSheetProps {
  children: ReactNode;
  /** Legacy gorhom prop — accepted but ignored. */
  snapPoints?: (string | number)[];
  /** Legacy gorhom prop — accepted but ignored. */
  enableDynamicSizing?: boolean;
  /** Legacy gorhom prop — accepted but ignored. */
  enablePanDownToClose?: boolean;
  onDismiss?: () => void;
  title?: string;
  showCloseButton?: boolean;
  /** Legacy gorhom prop — accepted but ignored. */
  keyboardBehavior?: 'interactive' | 'extend' | 'fillParent';
  /** Wrap children in a ScrollView when true (default). */
  scrollable?: boolean;
  contentPadding?: number;
  /** Declarative visibility. */
  visible?: boolean;
  /**
   * Controls whether the sheet hugs its content or reserves the full
   * snapPoint height. Defaults are inferred from `scrollable`:
   *   - `scrollable === true`  → autoHeight defaults to TRUE  (ScrollView
   *     hugs short content with snapPoint as a max cap)
   *   - `scrollable === false` → autoHeight defaults to FALSE (non-scroll
   *     callers usually wrap children in `flex: 1` and need a real height)
   * Pass an explicit boolean to override the inferred default.
   */
  autoHeight?: boolean;
  /**
   * Optional sticky footer that always sits at the bottom of the sheet,
   * above the safe-area inset. Use this for primary actions (Cancel /
   * Confirm) so the content area can hug naturally and the buttons never
   * sit on top of the home indicator.
   */
  footer?: ReactNode;
}

function parseSnapPoint(point: string | number, screenHeight: number): number {
  if (typeof point === 'number') return point;
  const pct = /^(\d+(?:\.\d+)?)%$/.exec(point);
  if (pct) return screenHeight * (parseFloat(pct[1]) / 100);
  const num = parseFloat(point);
  return isNaN(num) ? 0 : num;
}

const AppBottomSheet = forwardRef<AppBottomSheetRef, AppBottomSheetProps>(
  (
    {
      children,
      onDismiss,
      title,
      showCloseButton = false,
      scrollable = true,
      contentPadding = spacing.lg,
      visible,
      snapPoints,
      autoHeight,
      footer,
    },
    ref
  ) => {
    // autoHeight default is INFERRED from `scrollable`:
    //   • scrollable=true (the default)  → autoHeight=true  → sheet hugs
    //     content using AppBottomSheet's built-in ScrollView. Snap point
    //     acts as a max cap; the ScrollView scrolls internally if content
    //     exceeds it.
    //   • scrollable=false                → autoHeight=false → sheet uses
    //     a fixed height (snap point or 90% default) so children that use
    //     `flex: 1` (custom internal ScrollViews, forms, maps) have a real
    //     height to fill. Without this, those sheets collapse to nothing.
    // Pass an explicit boolean to override.
    const resolvedAutoHeight = autoHeight ?? scrollable;
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    // Track whether the modal is open. When the parent supplies `visible`,
    // it's the source of truth. Otherwise present()/dismiss() drive it.
    const [internalVisible, setInternalVisible] = useState(false);
    const isControlled = visible !== undefined;
    const open = isControlled ? !!visible : internalVisible;

    useImperativeHandle(
      ref,
      () => ({
        present: () => {
          if (!isControlled) setInternalVisible(true);
        },
        dismiss: () => {
          if (!isControlled) setInternalVisible(false);
          onDismiss?.();
        },
      }),
      [isControlled, onDismiss]
    );

    const handleRequestClose = useCallback(() => {
      if (!isControlled) setInternalVisible(false);
      onDismiss?.();
    }, [isControlled, onDismiss]);

    // Drag-to-dismiss. PanResponder is built into React Native and works
    // reliably inside <Modal> on both iOS and Android — unlike
    // react-native-gesture-handler, which requires a GestureHandlerRootView
    // inside the modal's native window and was firing inconsistently.
    const translateY = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      if (open) translateY.setValue(0);
    }, [open, translateY]);

    // Keep handleRequestClose accessible to the long-lived PanResponder
    // without re-creating the responder on every render (which would lose
    // gesture state mid-drag).
    const closeRef = useRef(handleRequestClose);
    useEffect(() => {
      closeRef.current = handleRequestClose;
    }, [handleRequestClose]);

    // This responder is attached to the WHOLE sheet (Animated.View). It only
    // claims a gesture when the user clearly swipes DOWNWARD by more than
    // ~8px and the motion is mostly vertical. That means:
    //   • Taps still fire (we never claim on touch start).
    //   • Upward swipes inside the body ScrollView still scroll normally
    //     (g.dy is negative, so we don't capture).
    //   • A deliberate drag-down from anywhere on the sheet — header, title,
    //     list rows, footer — dismisses the sheet, matching native iOS feel.
    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => false,
          onStartShouldSetPanResponderCapture: () => false,
          onMoveShouldSetPanResponder: (_e, g) =>
            g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
          // Capture is the key bit — without it the inner ScrollView would
          // win the gesture and the sheet would feel undraggable from the
          // list area. We only capture on a clear downward swipe so the
          // ScrollView can still scroll up freely.
          onMoveShouldSetPanResponderCapture: (_e, g) =>
            g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
          onPanResponderMove: (_e, g) => {
            // Clamp upward drag to 0 so the sheet never lifts off the
            // bottom of the screen (which would expose anything behind it).
            translateY.setValue(g.dy > 0 ? g.dy : 0);
          },
          onPanResponderRelease: (_e, g) => {
            if (g.dy > 100 || g.vy > 1.0) {
              Animated.timing(translateY, {
                toValue: 800,
                duration: 180,
                useNativeDriver: true,
              }).start(() => {
                translateY.setValue(0);
                closeRef.current();
              });
            } else {
              Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                bounciness: 6,
                speed: 24,
              }).start();
            }
          },
          onPanResponderTerminate: () => {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 6,
              speed: 24,
            }).start();
          },
        }),
      [translateY]
    );

    // When a sticky footer is present, the footer handles bottom safe-area
    // padding itself; don't double-pad inside the scrollable content.
    const innerStyle = {
      paddingHorizontal: contentPadding,
      paddingBottom: footer
        ? contentPadding
        : contentPadding + Math.max(insets.bottom, 0),
    };

    const Header = title || showCloseButton ? (
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.border, backgroundColor: colors.background },
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
            onPress={handleRequestClose}
            hitSlop={8}
            style={styles.closeBtn}
          >
            <X size={20} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
    ) : null;

    const screenHeight = Dimensions.get('window').height;
    // Honor the call-site snapPoint as the SHEET HEIGHT (or max, in auto
    // mode). When the caller doesn't specify, autoHeight sheets default to
    // a 75% cap (so long lists scroll internally and leave context behind
    // the sheet visible) and fixed-height sheets default to 90%. Hard cap
    // at 92% either way so the status bar is never covered.
    const defaultCap = resolvedAutoHeight ? 0.65 : 0.9;
    const requestedHeight = snapPoints && snapPoints.length
      ? Math.max(...snapPoints.map(p => parseSnapPoint(p, screenHeight)))
      : screenHeight * defaultCap;
    const sheetHeight = Math.min(requestedHeight, screenHeight * 0.92);

    // autoHeight=true → maxHeight only (sheet hugs short content); false →
    // fixed height (children with flex:1 lay out correctly).
    const useFixedHeight = !resolvedAutoHeight;
    const sheetSizeStyle = useFixedHeight
      ? { height: sheetHeight }
      : { maxHeight: sheetHeight };

    // Body fills the sheet only when the sheet has a defined height. In the
    // autoHeight + scrollable path we let the ScrollView shrink so it hugs
    // its content; otherwise it would expand to fill the cap and defeat
    // autoHeight. The ScrollView still scrolls when content exceeds the
    // wrapper's maxHeight because it inherits the cap from its parent.
    const fillStyle = useFixedHeight ? { flex: 1 } : { flexShrink: 1 };

    const body = scrollable ? (
      <ScrollView
        style={[{ backgroundColor: colors.background }, fillStyle]}
        contentContainerStyle={innerStyle}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    ) : (
      <View style={[innerStyle, { backgroundColor: colors.background }, fillStyle]}>
        {children}
      </View>
    );

    const Footer = footer ? (
      <View
        style={{
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
          paddingTop: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingBottom: Math.max(insets.bottom, spacing.md),
        }}
      >
        {footer}
      </View>
    ) : null;

    return (
      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={handleRequestClose}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable
            style={styles.backdropFill}
            onPress={handleRequestClose}
          />
          <Animated.View
            collapsable={false}
            {...panResponder.panHandlers}
            style={[
              styles.sheet,
              sheetSizeStyle,
              {
                backgroundColor: colors.background,
                transform: [{ translateY }],
              },
            ]}
          >
            {/* Pan responder is attached to the whole Animated.View so the
                entire sheet — header, body, footer — is a valid drag
                target. The capture rules only steal the gesture on a
                clear DOWNWARD swipe so the body ScrollView still scrolls
                upward freely. */}
            <View style={styles.dragZone} />
            {Header}
            {body}
            {Footer}
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }
);

AppBottomSheet.displayName = 'AppBottomSheet';

export function useAppBottomSheet() {
  const ref = useRef<AppBottomSheetRef>(null);
  const present = useCallback(() => ref.current?.present(), []);
  const dismiss = useCallback(() => ref.current?.dismiss(), []);
  return { ref, present, dismiss };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backdropFill: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  // Invisible drag strip at the top of every sheet. Most sheets use the
  // built-in Header (in which case the whole sheet is also a drag target),
  // but ~95 sheets render their OWN custom header inside the body using
  // TouchableOpacity buttons that trap touches and block PanResponder
  // capture. For those, this strip is the only reliable place to grab —
  // so it's deliberately large enough to be an easy thumb target even
  // though it's visually empty.
  dragZone: {
    height: 22,
    alignSelf: 'stretch',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
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

// Back-compat re-exports so existing call-sites that imported these from
// AppBottomSheet keep working. They now resolve to plain react-native
// primitives instead of the gorhom variants.
export const BottomSheetScrollView = (
  props: ScrollViewProps,
) => <ScrollView {...props} />;
export const BottomSheetView = View;
export const BottomSheetFlatList = FlatList;

export default AppBottomSheet;
