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

    const presentWithRetry = useCallback(() => {
      // @gorhom/bottom-sheet v5 needs the BottomSheetModal to *register* with
      // the BottomSheetModalProvider before present() actually does anything.
      // Ref attachment is sync but registration is async, so a single
      // present() (or one rAF deferral) silently no-ops on first open of
      // many sheets ("Assign Worker", "Preview", etc).
      // Solution: call present() repeatedly across several frames. Extra
      // present() calls on an already-open sheet are safe no-ops.
      presentRetryCancelRef.current?.cancel();
      let cancelled = false;
      let attempts = 0;
      // 30 attempts × 100ms = 3 seconds. Cross-screen navigations (dashboard
      // → job page → auto-open) can take longer than the previous 320ms
      // budget on slow networks because the sheet only mounts after the
      // job query resolves. Extra present() calls on an already-open sheet
      // are no-ops, so the worst case is a few wasted calls.
      // EAS dev builds run reanimated on the JS thread (debug runtime), so
      // present()/animations can be starved for several frames. Release/
      // TestFlight builds run reanimated on the UI thread and don't need
      // this. We extend the retry window AND also call snapToIndex(0) and
      // expand() as belt-and-braces — each goes through a different code
      // path inside gorhom, so if one races, another wins.
      const maxAttempts = 60;
      const tryPresent = () => {
        if (cancelled) return;
        const ref: any = sheetRef.current;
        ref?.present();
        // After the first attempt, also poke snapToIndex(0) — this is the
        // path that wins when present() registered the modal but the
        // animation never started (common in dev-build reanimated).
        if (attempts > 0) {
          try { ref?.snapToIndex?.(0); } catch {}
          try { ref?.expand?.(); } catch {}
        }
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(tryPresent, 80);
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
      sheetRef.current?.dismiss();
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
