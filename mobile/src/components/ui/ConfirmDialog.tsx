import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../lib/theme';
import { radius, spacing, typography, shadows } from '../../lib/design-tokens';

export interface ConfirmDialogOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  showCancel?: boolean;
}

interface ConfirmDialogContextType {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextType | null>(null);

interface PendingState extends ConfirmDialogOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingState | null>(null);
  const { colors, isDark } = useTheme();

  const confirm = useCallback((options: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const handleClose = (result: boolean) => {
    if (pending) pending.resolve(result);
    setPending(null);
  };

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      <Modal
        visible={!!pending}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => handleClose(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => handleClose(false)}>
          <Pressable
            style={[
              styles.dialog,
              { backgroundColor: colors.card, borderColor: colors.border },
              shadows.lg as object,
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={3}>
              {pending?.title}
            </Text>
            {pending?.message ? (
              <Text style={[styles.message, { color: colors.mutedForeground }]}>
                {pending.message}
              </Text>
            ) : null}
            <View style={styles.actions}>
              {pending?.showCancel !== false ? (
                <Pressable
                  onPress={() => handleClose(false)}
                  style={({ pressed }) => [
                    styles.btn,
                    {
                      backgroundColor: pressed
                        ? colors.muted
                        : isDark
                          ? colors.muted
                          : colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.btnText, { color: colors.foreground }]}>
                    {pending?.cancelText ?? 'Cancel'}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  handleClose(true);
                }}
                style={({ pressed }) => {
                  const bg = pending?.destructive ? colors.destructive : colors.primary;
                  return [
                    styles.btn,
                    {
                      backgroundColor: pressed ? bg + 'cc' : bg,
                      borderColor: bg,
                    },
                  ];
                }}
              >
                <Text
                  style={[
                    styles.btnText,
                    {
                      color: pending?.destructive
                        ? colors.destructiveForeground
                        : colors.primaryForeground,
                    },
                  ]}
                >
                  {pending?.confirmText ?? 'Confirm'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog(): ConfirmDialogContextType['confirm'] {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    return async (opts) => {
      if (Platform.OS === 'web') {
        // eslint-disable-next-line no-alert
        return Promise.resolve(window.confirm(opts.message ?? opts.title));
      }
      return Promise.resolve(false);
    };
  }
  return ctx.confirm;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    ...typography.cardTitle,
  },
  message: {
    ...typography.body,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  btn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  btnText: {
    ...typography.bodySemibold,
  },
});

export default ConfirmDialogProvider;
