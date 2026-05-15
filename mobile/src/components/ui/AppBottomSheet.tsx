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

    // Track in-flight present() retry loops so a dismiss() can cancel them
    // (otherwise a queued present() would re-open the sheet right after close).
    const presentRetryCancelRef = useRef<{ cancel: () => void } | null>(null);
    // Track whether the sheet is currently open (per gorhom onChange index).
    // Once it's open we MUST stop calling present(); v5 interprets a redundant
    // present() on an already-open sheet as a dismiss+represent cycle, which
    // can race with snap animations and end with the sheet closed instead of
    // open. That manifested as "tap registers, button dims, nothing appears".
    const isPresentedRef = useRef(false);

    const presentWithRetry = useCallback(() => {
      // @gorhom/bottom-sheet v5 needs the BottomSheetModal to *register* with
      // the BottomSheetModalProvider before present() actually does anything.
      // Ref attachment is sync but registration is async, so a single
      // present() (or one rAF deferral) silently no-ops on first open of
      // many sheets ("Assign Worker", "Preview", etc).
      // Solution: retry present() across a few frames, but STOP the moment
      // gorhom reports the sheet has actually opened (isPresentedRef = true).
      presentRetryCancelRef.current?.cancel();
      let cancelled = false;
      let attempts = 0;
      const maxAttempts = 30;
      const tryPresent = () => {
        if (cancelled) return;
        // Critical: bail out once the sheet is actually open. Calling
        // present() again would trigger an internal dismiss/represent cycle
        // and the sheet would close itself.
        if (isPresentedRef.current) return;
        sheetRef.current?.present();
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(tryPresent, 100);
        }
      };
      requestAnimationFrame(tryPresent);
      const handle = {
        cancel: () => {
          cancelled = true;
        },
      };
      presentRetryCancelRef.current = handle;
    }, []);

    const dismissAndCancel = useCallback(() => {
      presentRetryCancelRef.current?.cancel();
      presentRetryCancelRef.current = null;
      isPresentedRef.current = false;
      sheetRef.current?.dismiss();
    }, []);

    const handleChange = useCallback((index: number) => {
      // index >= 0 means the sheet is at a snap point (open).
      // index === -1 means closed/dismissed.
      isPresentedRef.current = index >= 0;
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        present: presentWithRetry,
        dismiss: dismissAndCancel,
      }),
      [presentWithRetry, dismissAndCancel]
    );

    useEffect(() => {
      if (visible === undefined) return;
      if (visible) {
        presentWithRetry();
      } else {
        dismissAndCancel();
      }
    }, [visible, presentWithRetry, dismissAndCancel]);

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
      isPresentedRef.current = false;
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
        onChange={handleChange}
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

// Re-export gorhom's BottomSheetScrollView so callers can import it from
// AppBottomSheet rather than reaching into @gorhom/bottom-sheet directly.
export { BottomSheetScrollView };

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
