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
    // Infer autoHeight default from `scrollable` when caller doesn't set it.
    // Scrollable sheets default to hugging content; non-scrollable sheets
    // default to fixed height because their children usually use flex: 1.
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

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          // Don't claim the gesture on touch start so taps on the close
          // button inside the header still fire.
          onStartShouldSetPanResponder: () => false,
          onStartShouldSetPanResponderCapture: () => false,
          // Claim on move when the finger has moved >10px downward and the
          // motion is more vertical than horizontal. Capture mirrors the
          // move handler so the responder grabs even when the touch is over
          // the title text or close button (child Pressables won't steal
          // the gesture mid-drag).
          onMoveShouldSetPanResponder: (_e, g) =>
            Math.abs(g.dy) > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
          onMoveShouldSetPanResponderCapture: (_e, g) =>
            Math.abs(g.dy) > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
          onPanResponderMove: (_e, g) => {
            if (g.dy >= 0) translateY.setValue(g.dy);
            else translateY.setValue(g.dy / 4); // resist upward drag
          },
          onPanResponderRelease: (_e, g) => {
            if (g.dy > 120 || g.vy > 1.2) {
              Animated.timing(translateY, {
                toValue: 800,
                duration: 200,
                useNativeDriver: true,
              }).start(() => {
                translateY.setValue(0);
                closeRef.current();
              });
            } else {
              Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                bounciness: 4,
                speed: 22,
              }).start();
            }
          },
          onPanResponderTerminate: () => {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 4,
              speed: 22,
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
    const defaultCap = resolvedAutoHeight ? 0.75 : 0.9;
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
            style={[
              styles.sheet,
              sheetSizeStyle,
              {
                backgroundColor: colors.background,
                transform: [{ translateY }],
              },
            ]}
          >
            {/* The drag responder wraps the drag zone + header so the user
                can grab anywhere across the top of the sheet to dismiss.
                PanResponder doesn't intercept taps (onStart returns false),
                so the header close button still works normally. */}
            <View {...panResponder.panHandlers} collapsable={false}>
              <View style={styles.dragZone} />
              {Header}
            </View>
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
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  backdropFill: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  // ~44px invisible hit zone at the top of every sheet. Big enough that a
  // user dragging from the rounded top edge reliably grabs the gesture even
  // without a visible grabber bar.
  dragZone: {
    height: 44,
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
