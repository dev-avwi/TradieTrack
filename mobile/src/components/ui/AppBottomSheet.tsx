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
  snapPoints?: (string | number)[];
  enableDynamicSizing?: boolean;
  enablePanDownToClose?: boolean;
  onDismiss?: () => void;
  title?: string;
  showCloseButton?: boolean;
  keyboardBehavior?: 'interactive' | 'extend' | 'fillParent';
  scrollable?: boolean;
  contentPadding?: number;
  visible?: boolean;
  autoHeight?: boolean;
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
    },
    ref
  ) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

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
          style={[typography.cardTitle, { color: colors.foreground, flex: 1 }]}
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

    const body = scrollable ? (
      <ScrollView
        style={{ backgroundColor: colors.background, flex: 1 }}
        contentContainerStyle={innerStyle}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    ) : (
      <View style={[innerStyle, { backgroundColor: colors.background, flex: 1 }]}>
        {children}
      </View>
    );

    // iOS: native pageSheet (UIKit). Real native rounded top, native dim,
    // native edge-swipe-to-dismiss, native rubber-band. Height is fixed by
    // the system — RN 0.81 doesn't expose iOS detents, so the sheet always
    // opens at the default pageSheet height regardless of content.
    if (Platform.OS === 'ios') {
      return (
        <Modal
          visible={open}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={handleRequestClose}
        >
          <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: colors.background }}
            behavior="padding"
          >
            {Header}
            {body}
          </KeyboardAvoidingView>
        </Modal>
      );
    }

    // Android: custom slide-up sheet (no native equivalent).
    return (
      <AndroidSheet
        open={open}
        onClose={handleRequestClose}
        background={colors.background}
        border={colors.border}
      >
        {Header}
        {body}
      </AndroidSheet>
    );
  }
);

AppBottomSheet.displayName = 'AppBottomSheet';

// Android slide-up sheet with drag-to-dismiss.
function AndroidSheet({
  open,
  onClose,
  background,
  border,
  children,
}: {
  open: boolean;
  onClose: () => void;
  background: string;
  border: string;
  children: ReactNode;
}) {
  const screenHeight = Dimensions.get('window').height;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) translateY.setValue(0);
  }, [open, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_e, g) => {
        if (g.dy >= 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 120 || g.vy > 0.6) {
          Animated.timing(translateY, {
            toValue: 800,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(0);
            onClose();
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
    })
  ).current;

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.androidRoot}>
        <Pressable style={styles.androidBackdrop} onPress={onClose} />
        <Animated.View
          style={[
            styles.androidSheet,
            {
              backgroundColor: background,
              maxHeight: screenHeight * 0.9,
              transform: [{ translateY }],
            },
          ]}
        >
          <View {...panResponder.panHandlers} style={styles.dragGrip}>
            <View style={[styles.handle, { backgroundColor: border }]} />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

export function useAppBottomSheet() {
  const ref = useRef<AppBottomSheetRef>(null);
  const present = useCallback(() => ref.current?.present(), []);
  const dismiss = useCallback(() => ref.current?.dismiss(), []);
  return { ref, present, dismiss };
}

const styles = StyleSheet.create({
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
  androidRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  androidBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  androidSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },
  dragGrip: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
});

export { AppBottomSheet };

export const BottomSheetScrollView = (props: ScrollViewProps) => (
  <ScrollView {...props} />
);
export const BottomSheetView = View;
export const BottomSheetFlatList = FlatList;

export default AppBottomSheet;
