import { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Animated,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, ThemeColors } from '../lib/theme';
import { spacing, radius, typography, shadows } from '../lib/design-tokens';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export interface QuickAction {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  primary?: boolean;
}

interface QuickActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  actions: QuickAction[];
}

export function QuickActionSheet({
  visible,
  onClose,
  title,
  subtitle,
  actions,
}: QuickActionSheetProps) {
  const { colors } = useTheme();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const open = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 26,
        stiffness: 280,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, backdropOpacity]);

  const close = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  }, [translateY, backdropOpacity, onClose]);

  useEffect(() => {
    if (visible) {
      open();
    }
  }, [visible, open]);

  const handleAction = useCallback((action: QuickAction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    close();
    setTimeout(() => action.onPress(), 280);
  }, [close]);

  const styles = createStyles(colors);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={close}
    >
      <TouchableWithoutFeedback onPress={close}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.sheet, { transform: [{ translateY }] }]}
      >
        <View style={styles.handle} />

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={close}
            style={styles.closeButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={styles.actions}>
          {actions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.actionRow,
                action.primary && styles.actionRowPrimary,
                action.destructive && styles.actionRowDestructive,
                index < actions.length - 1 && styles.actionRowBorder,
              ]}
              onPress={() => handleAction(action)}
              activeOpacity={0.65}
            >
              <View style={[
                styles.actionIcon,
                action.primary && { backgroundColor: `${colors.primary}18` },
                action.destructive && { backgroundColor: `${colors.destructive}12` },
              ]}>
                <Feather
                  name={action.icon}
                  size={18}
                  color={
                    action.destructive
                      ? colors.destructive
                      : action.primary
                        ? colors.primary
                        : colors.foreground
                  }
                />
              </View>
              <Text style={[
                styles.actionLabel,
                action.primary && { color: colors.primary, fontWeight: '600' },
                action.destructive && { color: colors.destructive },
              ]}>
                {action.label}
              </Text>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={close}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        {Platform.OS === 'ios' && <View style={styles.safeAreaBottom} />}
      </Animated.View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.52)',
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.card,
      borderTopLeftRadius: radius['2xl'],
      borderTopRightRadius: radius['2xl'],
      ...shadows.lg,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerText: {
      flex: 1,
    },
    title: {
      ...typography.cardTitle,
      color: colors.foreground,
    },
    subtitle: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    closeButton: {
      padding: spacing.xs,
      backgroundColor: colors.muted,
      borderRadius: radius.full,
      marginLeft: spacing.sm,
    },
    actions: {
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      gap: spacing.md,
    },
    actionRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    actionRowPrimary: {
      backgroundColor: `${colors.primary}06`,
    },
    actionRowDestructive: {
      backgroundColor: `${colors.destructive}04`,
    },
    actionIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.muted,
    },
    actionLabel: {
      flex: 1,
      ...typography.body,
      color: colors.foreground,
    },
    cancelButton: {
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.muted,
      alignItems: 'center',
    },
    cancelText: {
      ...typography.bodySemibold,
      color: colors.foreground,
    },
    safeAreaBottom: {
      height: 20,
    },
  });
