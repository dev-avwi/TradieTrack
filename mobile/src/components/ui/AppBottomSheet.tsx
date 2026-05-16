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
  Animated,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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
      autoHeight = true,
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
    // Drag-to-dismiss via react-native-gesture-handler Pan. This works
    // alongside ScrollViews/Touchables (unlike PanResponder) and only
    // activates once the finger moves >8px vertically downward.
    const dragGesture = Gesture.Pan()
      .activeOffsetY(8)
      .failOffsetX([-12, 12])
      .onUpdate((e) => {
        if (e.translationY >= 0) {
          translateY.setValue(e.translationY);
        } else {
          translateY.setValue(e.translationY / 4);
        }
      })
      .onEnd((e) => {
        if (e.translationY > 120 || e.velocityY > 600) {
          Animated.timing(translateY, {
            toValue: 800,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(0);
            handleRequestClose();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
            speed: 22,
          }).start();
        }
      });

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
    const sheetHeight = Math.min(requestedHeight, screenHeight * 0.92);

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

    // Single content-hugging slide-up sheet for both platforms. We tried
    // iOS `presentationStyle="pageSheet"` (truly native) but RN 0.81 core
    // can't drive UISheetPresentationController detents, so pageSheet is
    // always full-sheet height with empty space under short content. This
    // custom transparent Modal hugs its content (capped at 85% screen)
    // while keeping the pageSheet *look*: rounded top, grabber, dim
    // backdrop, slide-up animation, drag-to-dismiss.
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
                  paddingTop: 0,
                  ...(autoHeight ? { maxHeight: sheetHeight } : { height: sheetHeight }),
                  transform: [{ translateY }],
                },
              ]}
            >
              <GestureDetector gesture={dragGesture}>
                <View style={styles.dragZone} />
              </GestureDetector>
              {Header ? (
                <GestureDetector gesture={dragGesture}>
                  <View>{Header}</View>
                </GestureDetector>
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  dragZone: {
    height: 14,
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
