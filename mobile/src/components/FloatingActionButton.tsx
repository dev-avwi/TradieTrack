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
    width: 48,
    height: 48,
    borderRadius: 12,
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
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    backgroundColor: 'transparent',
  },
  quickActionText: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.mutedForeground,
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

  // Main grid actions - 4 core create actions
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
                        size={20} 
                        color={iconColor} 
                      />
                    </View>
                    <Text style={styles.menuItemLabel}>{action.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Bottom bar: AI Assistant, Collect Payment - larger buttons */}
            <View style={styles.quickActionsBar}>
              <TouchableOpacity
                style={[styles.quickActionButton, { backgroundColor: 'rgba(255, 59, 48, 0.1)', paddingVertical: 10, paddingHorizontal: 16 }]}
                onPress={() => {
                  setIsOpen(false);
                  router.push('/more/ai-assistant');
                }}
                activeOpacity={0.7}
              >
                <Feather name="zap" size={16} color="#FF3B30" />
                <Text style={[styles.quickActionText, { fontSize: 13, fontWeight: '500', color: '#FF3B30' }]}>AI Assistant</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickActionButton, { backgroundColor: 'rgba(255, 204, 0, 0.15)', paddingVertical: 10, paddingHorizontal: 16 }]}
                onPress={() => {
                  setIsOpen(false);
                  router.push('/more/collect-payment');
                }}
                activeOpacity={0.7}
              >
                <Feather name="credit-card" size={16} color="#CC9900" />
                <Text style={[styles.quickActionText, { fontSize: 13, fontWeight: '500', color: '#CC9900' }]}>Collect Payment</Text>
              </TouchableOpacity>
            </View>

          </View>
        </Pressable>
      </Modal>
    </>
  );
}
