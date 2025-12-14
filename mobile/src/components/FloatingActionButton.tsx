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
  Easing
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme, ThemeColors } from '../lib/theme';
import { spacing, radius, shadows, typography, iconSizes } from '../lib/design-tokens';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
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

export function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scaleAnim = useRef(new Animated.Value(1)).current;

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
        router.push('/more/create-job');
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
            { transform: [{ scale: scaleAnim }] }
          ]}
        >
          <Feather 
            name={isOpen ? 'x' : 'star'} 
            size={24} 
            color={isOpen ? colors.background : '#FFFFFF'} 
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
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
