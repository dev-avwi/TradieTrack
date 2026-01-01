import { useState, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal,
  Pressable,
  Animated,
  Dimensions,
  Easing,
  Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme, ThemeColors, colorWithOpacity } from '../lib/theme';
import { spacing, radius, shadows, typography, iconSizes } from '../lib/design-tokens';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isIOS = Platform.OS === 'ios';

interface FABAction {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  fabButton: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    // iOS: True pill shape (wider, shorter), Android: Material circular FAB (56x56 minimum)
    width: isIOS ? 56 : 56,
    height: isIOS ? 44 : 56,
    borderRadius: isIOS ? 22 : 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    // iOS: Subtle shadow, Android: Material elevation
    ...(isIOS ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    } : shadows.lg),
    zIndex: 1000,
  },
  fabButtonActive: {
    backgroundColor: colors.foreground,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius['xl'],
    borderTopRightRadius: radius['xl'],
    paddingTop: spacing.md,
    paddingBottom: 24,
    paddingHorizontal: spacing.md,
  },
  menuHandle: {
    width: 32,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  menuTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  menuItem: {
    alignItems: 'center',
    width: 72,
    paddingVertical: spacing.xs,
  },
  menuItemIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  menuItemLabel: {
    ...typography.captionSmall,
    color: colors.foreground,
    textAlign: 'center',
    fontWeight: '500',
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
  },
  quickActionText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
});

interface FloatingActionButtonProps {
  isTeamOwner?: boolean;
  onAssignPress?: () => void;
  fabStyle?: 'phone' | 'tablet';
}

export function FloatingActionButton({ isTeamOwner = false, onAssignPress, fabStyle = 'phone' }: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const fabPositionStyle = fabStyle === 'tablet' ? { bottom: 24, right: 24 } : {};

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.92,
      duration: 100,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 400,
      useNativeDriver: true,
    }).start();
  };

  const actions: FABAction[] = [
    {
      icon: 'briefcase',
      label: 'New Job',
      onPress: () => {
        setIsOpen(false);
        router.push('/job/create');
      },
    },
    {
      icon: 'file-text',
      label: 'New Quote',
      onPress: () => {
        setIsOpen(false);
        router.push('/more/quote/new');
      },
    },
    {
      icon: 'dollar-sign',
      label: 'New Invoice',
      onPress: () => {
        setIsOpen(false);
        router.push('/more/invoice/new');
      },
    },
    {
      icon: 'credit-card',
      label: 'Collect Payment',
      onPress: () => {
        setIsOpen(false);
        router.push('/more/collect-payment');
      },
    },
    {
      icon: 'users',
      label: 'Assign Job',
      onPress: () => {
        setIsOpen(false);
        if (onAssignPress) {
          onAssignPress();
        } else {
          router.push('/more/team-management');
        }
      },
    },
    {
      icon: 'zap',
      label: 'AI Assistant',
      onPress: () => {
        setIsOpen(false);
        router.push('/more/ai-assistant');
      },
    },
  ];

  return (
    <>
      <Pressable
        onPress={() => setIsOpen(true)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View 
          style={[
            styles.fabButton, 
            isOpen && styles.fabButtonActive,
            fabPositionStyle,
            { transform: [{ scale: scaleAnim }] }
          ]}
        >
          <Feather 
            name={isOpen ? 'x' : 'star'} 
            size={24} 
            color={isOpen ? colors.background : colors.primaryForeground} 
          />
        </Animated.View>
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setIsOpen(false)}
        >
          <View style={styles.menuContainer}>
            <View style={styles.menuHandle} />
            <Text style={styles.menuTitle}>Quick Create</Text>
            
            <View style={styles.menuGrid}>
              {actions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.menuItem}
                  onPress={action.onPress}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuItemIcon, { backgroundColor: colorWithOpacity(colors.primary, 0.1) }]}>
                    <Feather 
                      name={action.icon} 
                      size={24} 
                      color={colors.primary} 
                    />
                  </View>
                  <Text style={styles.menuItemLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

          </View>
        </Pressable>
      </Modal>
    </>
  );
}
