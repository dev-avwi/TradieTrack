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
import { useTheme, ThemeColors } from '../lib/theme';
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
    bottom: 110,
    right: 20,
    // iOS: True pill shape (wider, shorter), Android: Material circular FAB
    width: isIOS ? 64 : 56,
    height: isIOS ? 48 : 56,
    borderRadius: isIOS ? 24 : 28, // iOS: half of height for true pill, Android: half of size for circle
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
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingTop: spacing.lg,
    paddingBottom: 40,
    paddingHorizontal: spacing.lg,
  },
  menuHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  menuTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  menuItem: {
    alignItems: 'center',
    width: 80,
    paddingVertical: spacing.md,
  },
  menuItemIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  menuItemLabel: {
    ...typography.caption,
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
      color: colors.primary,
      onPress: () => {
        setIsOpen(false);
        router.push('/job/create');
      },
    },
    {
      icon: 'file-text',
      label: 'New Quote',
      color: colors.info,
      onPress: () => {
        setIsOpen(false);
        router.push('/more/quote/new');
      },
    },
    {
      icon: 'dollar-sign',
      label: 'New Invoice',
      color: colors.success,
      onPress: () => {
        setIsOpen(false);
        router.push('/more/invoice/new');
      },
    },
    {
      icon: 'credit-card',
      label: 'Collect Payment',
      color: colors.done || '#22C55E',
      onPress: () => {
        setIsOpen(false);
        router.push('/more/collect-payment');
      },
    },
    {
      icon: 'user-plus',
      label: 'New Client',
      color: colors.warning,
      onPress: () => {
        setIsOpen(false);
        router.push('/more/client/new');
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
            name={isOpen ? 'x' : 'plus'} 
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
                  <View style={[styles.menuItemIcon, { backgroundColor: `${action.color}15` }]}>
                    <Feather 
                      name={action.icon} 
                      size={24} 
                      color={action.color} 
                    />
                  </View>
                  <Text style={styles.menuItemLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.quickActionsRow}>
              <TouchableOpacity 
                style={styles.quickAction}
                onPress={() => {
                  setIsOpen(false);
                  router.push('/more/ai-assistant');
                }}
              >
                <Feather name="zap" size={14} color={colors.primary} />
                <Text style={styles.quickActionText}>AI Assistant</Text>
              </TouchableOpacity>
              {isTeamOwner ? (
                <TouchableOpacity 
                  style={styles.quickAction}
                  onPress={() => {
                    setIsOpen(false);
                    if (onAssignPress) {
                      onAssignPress();
                    } else {
                      router.push('/more/team-management');
                    }
                  }}
                >
                  <Feather name="users" size={14} color={colors.info} />
                  <Text style={styles.quickActionText}>Assign Job</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.quickAction}
                  onPress={() => {
                    setIsOpen(false);
                    router.push('/(tabs)/collect');
                  }}
                >
                  <Feather name="credit-card" size={14} color={colors.success} />
                  <Text style={styles.quickActionText}>Collect Payment</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
