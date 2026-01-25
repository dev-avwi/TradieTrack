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
import { SIDEBAR_WIDTH } from '../lib/device';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isIOS = Platform.OS === 'ios';

interface FABAction {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
}

// Subtle, light action colors - professional iOS aesthetic with gentle color hints
const ACTION_COLORS = {
  job: '#007AFF',      // iOS blue - jobs/briefcase
  quote: '#5856D6',    // iOS purple - quotes/documents  
  invoice: '#34C759',  // iOS green - money/invoices
  client: '#FF9500',   // iOS orange - people/clients
  payment: '#34C759',  // iOS green - payments
  assign: '#007AFF',   // iOS blue - assignments
};

// Light background versions for icon containers (10% opacity of main colors)
const ACTION_BG_COLORS = {
  job: 'rgba(0, 122, 255, 0.12)',      // Light blue
  quote: 'rgba(88, 86, 214, 0.12)',    // Light purple
  invoice: 'rgba(52, 199, 89, 0.12)',  // Light green
  client: 'rgba(255, 149, 0, 0.12)',   // Light orange
  payment: 'rgba(52, 199, 89, 0.12)',  // Light green
  assign: 'rgba(0, 122, 255, 0.12)',   // Light blue
};

const createStyles = (colors: ThemeColors, isTabletStyle: boolean) => StyleSheet.create({
  fabButton: {
    position: 'absolute',
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
  // Phone: bottom sheet style | Tablet: offset by sidebar width to center in content area
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: isTabletStyle ? 'center' : 'flex-end',
    alignItems: isTabletStyle ? 'center' : 'stretch',
    // On tablet, add left padding equal to sidebar width so popup centers in content area
    paddingLeft: isTabletStyle ? SIDEBAR_WIDTH : 0,
  },
  // Phone: bottom sheet | Tablet: centered popup (25% larger for tablet)
  menuContainer: {
    backgroundColor: colors.card,
    ...(isTabletStyle ? {
      borderRadius: radius['xl'],
      width: 400, // 25% larger (was 320)
      maxWidth: '90%',
    } : {
      borderTopLeftRadius: radius['xl'],
      borderTopRightRadius: radius['xl'],
    }),
    paddingTop: isTabletStyle ? spacing.lg : spacing.md,
    paddingBottom: isTabletStyle ? 32 : 24,
    paddingHorizontal: isTabletStyle ? spacing.xl : spacing.lg,
    ...(isTabletStyle ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 25 },
      shadowOpacity: 0.25,
      shadowRadius: 50,
      elevation: 24,
    } : {}),
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  menuHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  menuHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.primary}20`,
  },
  menuCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
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
    width: isTabletStyle ? 85 : 76, // 25% larger for tablet (was 68)
    paddingVertical: isTabletStyle ? spacing.sm : spacing.xs,
  },
  menuItemIcon: {
    width: isTabletStyle ? 65 : 48, // 25% larger for tablet (was 52)
    height: isTabletStyle ? 65 : 48, // 25% larger for tablet (was 52)
    borderRadius: isTabletStyle ? 16 : 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: isTabletStyle ? 8 : 6,
  },
  menuItemLabel: {
    fontSize: isTabletStyle ? 13 : 11, // slightly larger for tablet
    color: colors.foreground,
    textAlign: 'center',
    fontWeight: '500',
  },
  quickActionsBar: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.xs,
    justifyContent: 'center',
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

interface FloatingActionButtonProps {
  isTeamOwner?: boolean;
  onAssignPress?: () => void;
  fabStyle?: 'phone' | 'tablet';
  bottomOffset?: number;
}

export function FloatingActionButton({ isTeamOwner = false, onAssignPress, fabStyle = 'phone', bottomOffset = 0 }: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { colors } = useTheme();
  const isTabletStyle = fabStyle === 'tablet';
  const styles = useMemo(() => createStyles(colors, isTabletStyle), [colors, isTabletStyle]);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const fabPositionStyle = isTabletStyle 
    ? { bottom: 24, right: 24 } 
    : { bottom: bottomOffset + 16, right: 20 };

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

  // Main grid actions - 4 core create actions + 2 extra for tablet
  type ColorKey = keyof typeof ACTION_COLORS;
  const gridActions: (FABAction & { colorKey: ColorKey })[] = [
    {
      icon: 'briefcase',
      label: 'New Job',
      colorKey: 'job',
      onPress: () => {
        setIsOpen(false);
        router.push('/more/create-job');
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
      icon: 'user-plus',
      label: 'New Client',
      colorKey: 'client',
      onPress: () => {
        setIsOpen(false);
        router.push('/more/client/new');
      },
    },
    // iPad only: extra actions to fill space
    ...(isTabletStyle ? [
      {
        icon: 'users' as keyof typeof Feather.glyphMap,
        label: 'Check Team',
        colorKey: 'assign' as ColorKey,
        onPress: () => {
          setIsOpen(false);
          router.push('/more/team-operations' as any);
        },
      },
      {
        icon: 'calendar' as keyof typeof Feather.glyphMap,
        label: 'Schedule',
        colorKey: 'job' as ColorKey,
        onPress: () => {
          setIsOpen(false);
          router.push('/more/schedule' as any);
        },
      },
    ] : []),
  ];

  return (
    <>
      <Pressable
        onPress={() => setIsOpen(true)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.fabButton, 
          isOpen && styles.fabButtonActive,
          fabPositionStyle,
        ]}
      >
        <Animated.View 
          style={[
            { 
              width: 56, 
              height: 56, 
              alignItems: 'center', 
              justifyContent: 'center',
              transform: [{ scale: scaleAnim }] 
            }
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
        animationType={isTabletStyle ? 'fade' : 'slide'}
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setIsOpen(false)}
        >
          <Pressable style={styles.menuContainer} onPress={(e) => e.stopPropagation()}>
            {/* Tablet: Header with icon and close button | Phone: Handle bar */}
            {isTabletStyle ? (
              <View style={styles.menuHeader}>
                <View style={styles.menuHeaderLeft}>
                  <View style={styles.menuHeaderIcon}>
                    <Feather name="star" size={16} color={colors.primary} />
                  </View>
                  <Text style={styles.menuTitle}>Quick Create</Text>
                </View>
                <TouchableOpacity 
                  style={styles.menuCloseButton}
                  onPress={() => setIsOpen(false)}
                  activeOpacity={0.7}
                >
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.menuHandle} />
                <Text style={[styles.menuTitle, { textAlign: 'center', marginBottom: spacing.md }]}>Quick Create</Text>
              </>
            )}
            
            {/* Main grid with subtle color-coded icons */}
            <View style={styles.menuGrid}>
              {gridActions.map((action, index) => {
                const bgColor = ACTION_BG_COLORS[action.colorKey];
                const iconColor = ACTION_COLORS[action.colorKey];
                return (
                  <TouchableOpacity
                    key={index}
                    style={styles.menuItem}
                    onPress={action.onPress}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.menuItemIcon, { backgroundColor: bgColor }]}>
                      <Feather 
                        name={action.icon} 
                        size={isTabletStyle ? 24 : 20} 
                        color={iconColor} 
                      />
                    </View>
                    <Text style={styles.menuItemLabel}>{action.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Bottom bar: AI Assistant, Collect Payment */}
            <View style={styles.quickActionsBar}>
              <TouchableOpacity
                style={[styles.quickActionButton, { borderColor: '#FF3B3040' }]}
                onPress={() => {
                  setIsOpen(false);
                  router.push('/more/ai-assistant');
                }}
                activeOpacity={0.7}
              >
                <Feather name="zap" size={14} color="#FF3B30" />
                <Text style={[styles.quickActionText, { color: '#FF3B30' }]}>AI Assistant</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickActionButton, { borderColor: '#34C75940' }]}
                onPress={() => {
                  setIsOpen(false);
                  router.push('/more/collect-payment');
                }}
                activeOpacity={0.7}
              >
                <Feather name="credit-card" size={14} color="#34C759" />
                <Text style={[styles.quickActionText, { color: '#34C759' }]}>Collect Payment</Text>
              </TouchableOpacity>
            </View>

          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
