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
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ScrollViewProps,
  FlatList,
  Dimensions,
  PanResponder,
  Animated,
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
  /** When true, the sheet hugs its content (with snapPoint as a max cap)
   *  instead of forcing a fixed height. Use this for sheets whose content
   *  is short (e.g. empty states) so they don't reserve a blank box. */
  autoHeight?: boolean;
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
      autoHeight = false,
    },
    ref
  ) => {
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

    // Drag-to-dismiss: track vertical translation and dismiss when the user
    // drags down past a threshold or releases with downward velocity.
    const translateY = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      if (open) translateY.setValue(0);
    }, [open, translateY]);
    const panResponder = useRef(
      PanResponder.create({
        // Capture on touch immediately so the user gets 1:1 finger tracking
        // from the very first frame — feels premium / iOS-native.
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderMove: (_e, g) => {
          // Follow the finger downward, and a tiny bit upward with rubber-band
          // resistance for a premium bouncy feel.
          if (g.dy >= 0) {
            translateY.setValue(g.dy);
          } else {
            translateY.setValue(g.dy / 3);
          }
        },
        onPanResponderRelease: (_e, g) => {
          if (g.dy > 120 || g.vy > 0.6) {
            Animated.timing(translateY, {
              toValue: 800,
              duration: 180,
              useNativeDriver: true,
            }).start(() => {
              translateY.setValue(0);
              handleRequestClose();
            });
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 6,
              speed: 14,
            }).start();
          }
        },
        onPanResponderTerminationRequest: () => false,
      })
    ).current;

    // Inner content padding mirrors the legacy AppBottomSheet so call-sites
    // that relied on it keep their look. Bottom inset clears the iOS home
    // indicator / Android nav bar.
    const innerStyle = {
      paddingHorizontal: contentPadding,
      paddingBottom: contentPadding + Math.max(insets.bottom, 0),
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
    // Premium-feel sizing: honor the call-site snapPoint as the SHEET HEIGHT
    // (not just a max), so call-sites with `flex: 1` wrappers stretch their
    // content to the full sheet — buttons land at the bottom of the sheet
    // instead of leaving a gap above the home indicator. Hard cap at 70%.
    const requestedHeight = snapPoints && snapPoints.length
      ? Math.max(...snapPoints.map(p => parseSnapPoint(p, screenHeight)))
      : screenHeight * 0.6;
    const sheetHeight = Math.min(requestedHeight, screenHeight * 0.7);

    const fillStyle = autoHeight ? { flexShrink: 1 } : { flex: 1 };
    const body = scrollable ? (
      <ScrollView
        style={{ backgroundColor: colors.background, ...fillStyle }}
        contentContainerStyle={innerStyle}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    ) : (
      <View style={[innerStyle, { backgroundColor: colors.background, ...fillStyle }]}>
        {children}
      </View>
    );

    // Single custom slide-up sheet path. We tried iOS `presentationStyle=
    // "pageSheet"` but RN 0.81's stock Modal silently ignores
    // `sheetAllowedDetents`, so pageSheet always renders at its fixed full-
    // sheet height — leaving white space below short content. The custom
    // transparent Modal below reproduces the pageSheet *look* (rounded top,
    // dim backdrop, grabber, slide-up animation, drag-to-dismiss) AND hugs
    // its content when `autoHeight` is on, which is what callers actually
    // want for short forms like Schedule Job and the empty Assign Workers.
    return (
      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={handleRequestClose}
        statusBarTranslucent
      >
        <View style={styles.root}>
          <Pressable
            style={styles.backdropFill}
            onPress={handleRequestClose}
          />
          <KeyboardAvoidingView behavior={undefined}>
            <Animated.View
              style={[
                styles.sheet,
                {
                  backgroundColor: colors.background,
                  paddingTop: spacing.sm,
                  ...(autoHeight ? { maxHeight: sheetHeight } : { height: sheetHeight }),
                  transform: [{ translateY }],
                },
              ]}
            >
              <View
                {...panResponder.panHandlers}
                style={styles.dragGrip}
              >
                <View style={[styles.handle, { backgroundColor: colors.border }]} />
              </View>
              {Header ? (
                <View {...panResponder.panHandlers}>{Header}</View>
              ) : null}
              {body}
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
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
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },
  dragGrip: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
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
