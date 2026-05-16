import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView as GorhomBottomSheetScrollView,
  BottomSheetView as GorhomBottomSheetView,
  BottomSheetFlatList as GorhomBottomSheetFlatList,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useTheme } from '../../lib/theme';
import { radius, spacing, typography } from '../../lib/design-tokens';

export interface AppBottomSheetRef {
  present: () => void;
  dismiss: () => void;
}

export interface AppBottomSheetProps {
  children: ReactNode;
  /** Optional fixed snap points. When omitted, sheet hugs its content. */
  snapPoints?: (string | number)[];
  /** Allow the sheet to grow to fit content. Default true. */
  enableDynamicSizing?: boolean;
  /** Allow pan-down-to-close gesture. Default true. */
  enablePanDownToClose?: boolean;
  onDismiss?: () => void;
  title?: string;
  showCloseButton?: boolean;
  keyboardBehavior?: 'interactive' | 'extend' | 'fillParent';
  /** Wrap children in a BottomSheetScrollView when true (default). */
  scrollable?: boolean;
  contentPadding?: number;
  /** Declarative visibility. */
  visible?: boolean;
  /** Legacy alias for enableDynamicSizing. */
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
      snapPoints,
      enableDynamicSizing,
      enablePanDownToClose = true,
      keyboardBehavior = 'interactive',
      autoHeight,
    },
    ref
  ) => {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const sheetRef = useRef<BottomSheetModal>(null);

    // Default: hug content only when no snapPoints are provided. If a
    // call-site explicitly asks for snap points, respect them as the source
    // of truth (mixing dynamic + snapPoints in gorhom v5 reorders snaps).
    const dynamic =
      autoHeight ??
      enableDynamicSizing ??
      (!snapPoints || snapPoints.length === 0);

    // Imperative API
    useImperativeHandle(
      ref,
      () => ({
        present: () => sheetRef.current?.present(),
        dismiss: () => sheetRef.current?.dismiss(),
      }),
      []
    );

    // Declarative visibility: drive present/dismiss from `visible` prop
    useEffect(() => {
      if (visible === undefined) return;
      if (visible) sheetRef.current?.present();
      else sheetRef.current?.dismiss();
    }, [visible]);

    const handleDismiss = useCallback(() => {
      Keyboard.dismiss();
      onDismiss?.();
    }, [onDismiss]);

    // Convert legacy snapPoints (numbers + percent strings) into gorhom format
    // (it accepts both, but normalize to strings for stability).
    const computedSnapPoints = useMemo(() => {
      if (!snapPoints || snapPoints.length === 0) return undefined;
      return snapPoints.map((p) => (typeof p === 'number' ? p : String(p)));
    }, [snapPoints]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.45}
          pressBehavior={enablePanDownToClose ? 'close' : 'none'}
        />
      ),
      [enablePanDownToClose]
    );

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
            onPress={() => sheetRef.current?.dismiss()}
            hitSlop={8}
            style={styles.closeBtn}
          >
            <X size={20} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
    ) : null;

    const ContentWrapper: any = scrollable
      ? GorhomBottomSheetScrollView
      : GorhomBottomSheetView;

    return (
      <BottomSheetModal
        ref={sheetRef}
        // Provide snapPoints only when explicitly requested. When omitted +
        // enableDynamicSizing, gorhom measures the content and grows the
        // sheet to match — premium content-hugging behaviour.
        snapPoints={computedSnapPoints}
        enableDynamicSizing={dynamic}
        enablePanDownToClose={enablePanDownToClose}
        onDismiss={handleDismiss}
        keyboardBehavior={keyboardBehavior}
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
        backgroundStyle={{
          backgroundColor: colors.background,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
        }}
        // Subtle drop shadow above the sheet to lift it off the dim backdrop
        // (matches the premium iOS pageSheet feel).
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: isDark ? 0.5 : 0.15,
          shadowRadius: 12,
          elevation: 16,
        }}
      >
        {Header}
        <ContentWrapper
          style={scrollable ? undefined : innerStyle}
          contentContainerStyle={scrollable ? innerStyle : undefined}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ContentWrapper>
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

// Re-export gorhom subcomponents so existing call-sites keep working.
export const BottomSheetScrollView = GorhomBottomSheetScrollView;
export const BottomSheetView = GorhomBottomSheetView;
export const BottomSheetFlatList = GorhomBottomSheetFlatList;

export default AppBottomSheet;
