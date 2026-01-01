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

// Theme-aware action color generator
const getActionColors = (colors: ThemeColors) => ({
  job: colors.primary,                    // Primary blue
  quote: colors.accent || colors.primary, // Accent or primary
  invoice: colors.success || '#10B981',   // Success green
  payment: colors.warning || '#F59E0B',   // Warning amber
  client: colors.secondary || colors.mutedForeground,
  ai: colors.primary,                     // Primary for AI
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  fabButton: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    // Apple HIG: minimum 44pt touch target
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 36,
    height: 5,
    backgroundColor: colors.border,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  menuTitle: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.mutedForeground,
    marginBottom: spacing.md,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  menuItem: {
    alignItems: 'center',
    width: 76,
    paddingVertical: spacing.xs,
  },
  menuItemIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  menuItemLabel: {
    fontSize: 11,
    color: colors.foreground,
    textAlign: 'center',
    fontWeight: '500',
  },
  quickActionsBar: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48, // Apple HIG minimum
    paddingVertical: 12,
    borderRadius: radius.lg,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '600',
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

  // Get theme-aware action colors
  const actionColors = getActionColors(colors);

  // Main grid actions - all roles get these 4 core actions
  type ColorKey = keyof ReturnType<typeof getActionColors>;
  const gridActions: (FABAction & { colorKey: ColorKey })[] = [
    {
      icon: 'briefcase',
      label: 'New Job',
      colorKey: 'job',
      onPress: () => {
        setIsOpen(false);
        router.push('/job/create');
      },
    },
    {
      icon: 'file-text',
      label: 'New Quote',
      colorKey: 'quote',
      onPress: () => {
        setIsOpen(false);
        router.push('/more/quote/new');
      },
    },
    {
      icon: 'dollar-sign',
      label: 'New Invoice',
      colorKey: 'invoice',
      onPress: () => {
        setIsOpen(false);
        router.push('/more/invoice/new');
      },
    },
    {
      icon: 'credit-card',
      label: 'Collect Payment',
      colorKey: 'payment',
      onPress: () => {
        setIsOpen(false);
        router.push('/more/collect-payment');
      },
    },
  ];

  // Role-based right action: Assign Job for owners/managers, New Client for others
  const rightBarAction = isTeamOwner ? {
    icon: 'users' as const,
    label: 'Assign Job',
    colorKey: 'client' as ColorKey,
    onPress: () => {
      setIsOpen(false);
      if (onAssignPress) {
        onAssignPress();
      } else {
        router.push('/more/team-management');
      }
    },
  } : {
    icon: 'user-plus' as const,
    label: 'New Client',
    colorKey: 'client' as ColorKey,
    onPress: () => {
      setIsOpen(false);
      router.push('/more/client/new');
    },
  };

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
            
            {/* Main grid with themed colored icons */}
            <View style={styles.menuGrid}>
              {gridActions.map((action, index) => {
                const actionColor = actionColors[action.colorKey];
                return (
                  <TouchableOpacity
                    key={index}
                    style={styles.menuItem}
                    onPress={action.onPress}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.menuItemIcon, { backgroundColor: colorWithOpacity(actionColor, 0.12) }]}>
                      <Feather 
                        name={action.icon} 
                        size={22} 
                        color={actionColor} 
                      />
                    </View>
                    <Text style={styles.menuItemLabel}>{action.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Bottom bar: AI Assistant (left) + Role-based action (right) */}
            <View style={styles.quickActionsBar}>
              <TouchableOpacity
                style={[styles.quickActionButton, { backgroundColor: colorWithOpacity(actionColors.ai, 0.1) }]}
                onPress={() => {
                  setIsOpen(false);
                  router.push('/more/ai-assistant');
                }}
                activeOpacity={0.7}
              >
                <Feather name="zap" size={18} color={actionColors.ai} />
                <Text style={[styles.quickActionText, { color: actionColors.ai }]}>AI Assistant</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickActionButton, { backgroundColor: colorWithOpacity(actionColors[rightBarAction.colorKey], 0.1) }]}
                onPress={rightBarAction.onPress}
                activeOpacity={0.7}
              >
                <Feather name={rightBarAction.icon} size={18} color={actionColors[rightBarAction.colorKey]} />
                <Text style={[styles.quickActionText, { color: actionColors[rightBarAction.colorKey] }]}>{rightBarAction.label}</Text>
              </TouchableOpacity>
            </View>

          </View>
        </Pressable>
      </Modal>
    </>
  );
}
