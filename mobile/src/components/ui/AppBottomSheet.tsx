import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetBackdropProps,
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
      visible,
    },
    ref
  ) => {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const sheetRef = useRef<BottomSheetModal>(null);

    useImperativeHandle(
      ref,
      () => ({
        present: () => sheetRef.current?.present(),
        dismiss: () => sheetRef.current?.dismiss(),
      }),
      []
    );

    // Declarative visibility support: drive the imperative bottom-sheet API
    // from a boolean prop so existing `<Modal visible={x}>` call-sites can
    // migrate with a single tag change.
    useEffect(() => {
      if (visible === undefined) return;
      if (visible) sheetRef.current?.present();
      else sheetRef.current?.dismiss();
    }, [visible]);

    const computedSnapPoints = useMemo(() => {
      if (snapPoints && snapPoints.length > 0) return snapPoints;
      if (enableDynamicSizing) return undefined;
      return ['50%', '90%'];
    }, [snapPoints, enableDynamicSizing]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.5}
          pressBehavior={enablePanDownToClose ? 'close' : 'none'}
        />
      ),
      [enablePanDownToClose]
    );

    const handleDismiss = useCallback(() => {
      onDismiss?.();
    }, [onDismiss]);

    const Header = title || showCloseButton ? (
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
            onPress={() => sheetRef.current?.dismiss()}
            hitSlop={8}
            style={styles.closeBtn}
          >
            <X size={20} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
    ) : null;

    // Add safe-area bottom inset so content (and any sticky CTA) clears the
    // Android edge-to-edge nav bar / iOS home indicator. Without this, the
    // last row of pickers / buttons is partially hidden behind system chrome.
    const innerStyle = {
      paddingHorizontal: contentPadding,
      paddingBottom: contentPadding + Math.max(insets.bottom, 0),
    };

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={computedSnapPoints}
        enableDynamicSizing={enableDynamicSizing && !computedSnapPoints}
        enablePanDownToClose={enablePanDownToClose}
        keyboardBehavior={keyboardBehavior}
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        onDismiss={handleDismiss}
        backdropComponent={renderBackdrop}
        backgroundStyle={[
          {
            backgroundColor: colors.card,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
          },
          shadows.lg as object,
        ]}
        handleIndicatorStyle={{
          backgroundColor: isDark ? colors.borderLight : colors.mutedForeground,
          opacity: 0.5,
          width: 40,
          height: 4,
        }}
        handleStyle={{
          paddingTop: 10,
          paddingBottom: 6,
        }}
      >
        {Header}
        {scrollable ? (
          <BottomSheetScrollView
            style={{ backgroundColor: colors.card }}
            contentContainerStyle={innerStyle}
            keyboardShouldPersistTaps="handled"
          >
            <>{children}</>
          </BottomSheetScrollView>
        ) : (
          // flex:1 so children with their own ScrollView (or list) get room
          // to render — without this, on Android the inner content collapses
          // to intrinsic height and the sheet appears empty.
          <View style={[innerStyle, { backgroundColor: colors.card, flex: 1 }]}>{children}</View>
        )}
      </BottomSheetModal>
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
