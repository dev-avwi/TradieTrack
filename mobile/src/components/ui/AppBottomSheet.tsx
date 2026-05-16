import React, {
  forwardRef,
  useCallback,
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
          { borderBottomColor: colors.border, backgroundColor: colors.card },
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
    // Honor legacy gorhom snapPoints as the MAX height. Sheet hugs content
    // below that — short sheets render small, tall sheets cap at the snap.
    const requestedMax = snapPoints && snapPoints.length
      ? Math.max(...snapPoints.map(p => parseSnapPoint(p, screenHeight)))
      : screenHeight * 0.9;
    const maxSheetHeight = Math.min(requestedMax, screenHeight * 0.9);

    // Strip `flex: 1` from the immediate call-site child so its layout sizes
    // to its actual content instead of demanding the full sheet height. This
    // is what unblocks content-aware sheet sizing without editing 18 call-sites.
    const flatten = (s: any): any =>
      Array.isArray(s) ? s.map(flatten) : s;
    const stripFlex = (style: any): any => {
      if (!style) return style;
      if (Array.isArray(style)) return style.map(stripFlex);
      if (typeof style === 'object' && ('flex' in style || 'flexGrow' in style)) {
        const { flex: _f, flexGrow: _g, ...rest } = style;
        return rest;
      }
      return style;
    };
    const childArray = React.Children.toArray(children);
    const processedChildren =
      childArray.length === 1 && React.isValidElement(childArray[0])
        ? React.cloneElement(childArray[0] as React.ReactElement<any>, {
            style: stripFlex(flatten((childArray[0] as React.ReactElement<any>).props.style)),
          })
        : children;

    const body = scrollable ? (
      <ScrollView
        style={{ backgroundColor: colors.card, maxHeight: maxSheetHeight }}
        contentContainerStyle={innerStyle}
        keyboardShouldPersistTaps="handled"
      >
        {processedChildren}
      </ScrollView>
    ) : (
      <View style={[innerStyle, { backgroundColor: colors.card }]}>
        {processedChildren}
      </View>
    );

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
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View
              style={[
                styles.sheet,
                {
                  backgroundColor: colors.card,
                  paddingTop: spacing.sm,
                  maxHeight: maxSheetHeight,
                },
              ]}
            >
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
              {Header}
              {body}
            </View>
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
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.sm,
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
