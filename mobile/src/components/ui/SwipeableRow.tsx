import { ReactNode, createContext, useContext, useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
  useAnimatedRef,
} from 'react-native-reanimated';
import { spacing, radius, motion } from '../../lib/design-tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ACTION_THRESHOLD = 80;
const FULL_SWIPE_THRESHOLD = SCREEN_WIDTH * 0.6;
const VELOCITY_THRESHOLD = 500;
const MIN_SWIPE_RATIO = 0.4;
const ACTION_WIDTH = 72;

interface HapticsModule {
  ImpactFeedbackStyle: {
    Light: number;
    Medium: number;
    Heavy: number;
  };
  NotificationFeedbackType: {
    Success: number;
    Warning: number;
    Error: number;
  };
  impactAsync: (style: number) => Promise<void>;
  notificationAsync: (type: number) => Promise<void>;
}

let Haptics: HapticsModule | null = null;
try {
  Haptics = require('expo-haptics') as HapticsModule;
} catch {
  Haptics = null;
}

const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'medium') => {
  if (Haptics) {
    const impactStyle = {
      light: Haptics.ImpactFeedbackStyle.Light,
      medium: Haptics.ImpactFeedbackStyle.Medium,
      heavy: Haptics.ImpactFeedbackStyle.Heavy,
    };
    Haptics.impactAsync(impactStyle[type]);
  }
};

const triggerNotificationHaptic = (type: 'success' | 'warning' | 'error' = 'success') => {
  if (Haptics) {
    const notificationType = {
      success: Haptics.NotificationFeedbackType.Success,
      warning: Haptics.NotificationFeedbackType.Warning,
      error: Haptics.NotificationFeedbackType.Error,
    };
    Haptics.notificationAsync(notificationType[type]);
  }
};

export interface SwipeAction {
  key: string;
  icon: ReactNode;
  color: string;
  onPress: () => void;
}

export interface SwipeableRowProps {
  children: ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  onOpen?: () => void;
  onClose?: () => void;
  id?: string;
}

type CloseCallback = () => void;

interface SwipeableRowContextType {
  registerRow: (id: string, closeCallback: CloseCallback) => void;
  unregisterRow: (id: string) => void;
  closeAllExcept: (id: string) => void;
  closeAll: () => void;
  scrollViewRef: ReturnType<typeof useAnimatedRef<any>> | null;
}

const SwipeableRowContext = createContext<SwipeableRowContextType | null>(null);

export function SwipeableRowProvider({ children }: { children: ReactNode }) {
  const rowsRef = useRef<Map<string, CloseCallback>>(new Map());
  const scrollViewRef = useAnimatedRef<any>();

  const registerRow = useCallback((id: string, closeCallback: CloseCallback) => {
    rowsRef.current.set(id, closeCallback);
  }, []);

  const unregisterRow = useCallback((id: string) => {
    rowsRef.current.delete(id);
  }, []);

  const closeAllExcept = useCallback((id: string) => {
    rowsRef.current.forEach((closeCallback, rowId) => {
      if (rowId !== id) {
        closeCallback();
      }
    });
  }, []);

  const closeAll = useCallback(() => {
    rowsRef.current.forEach((closeCallback) => {
      closeCallback();
    });
  }, []);

  return (
    <SwipeableRowContext.Provider
      value={{ registerRow, unregisterRow, closeAllExcept, closeAll, scrollViewRef }}
    >
      {children}
    </SwipeableRowContext.Provider>
  );
}

export function useSwipeableScrollRef() {
  const context = useContext(SwipeableRowContext);
  return context?.scrollViewRef ?? null;
}

export function useSwipeableRow() {
  const context = useContext(SwipeableRowContext);
  return context;
}

export const actionColors = {
  delete: '#EF4444',
  archive: '#3B82F6',
  edit: '#EAB308',
  call: '#22C55E',
} as const;

export type ActionType = keyof typeof actionColors;

export function SwipeableRow({
  children,
  leftActions = [],
  rightActions = [],
  onOpen,
  onClose,
  id,
}: SwipeableRowProps) {
  const translateX = useSharedValue(0);
  const contextX = useSharedValue(0);
  const isOpen = useSharedValue(false);
  const hasTriggeredHaptic = useSharedValue(false);
  
  const rowId = useRef(id || `row-${Date.now()}-${Math.random()}`).current;
  const context = useContext(SwipeableRowContext);

  const springConfig = {
    damping: motion.springDefault.damping,
    stiffness: motion.springDefault.stiffness,
  };

  const leftActionsWidth = leftActions.length * ACTION_WIDTH;
  const rightActionsWidth = rightActions.length * ACTION_WIDTH;

  const close = useCallback(() => {
    'worklet';
    translateX.value = withSpring(0, springConfig);
    isOpen.value = false;
    if (onClose) {
      runOnJS(onClose)();
    }
  }, [onClose, springConfig, translateX, isOpen]);

  const closeFromJS = useCallback(() => {
    translateX.value = withSpring(0, springConfig);
    isOpen.value = false;
    onClose?.();
  }, [onClose, springConfig, translateX, isOpen]);

  const handleActionPress = useCallback((action: SwipeAction) => {
    triggerNotificationHaptic('success');
    closeFromJS();
    action.onPress();
  }, [closeFromJS]);

  useEffect(() => {
    if (context) {
      context.registerRow(rowId, closeFromJS);
      return () => context.unregisterRow(rowId);
    }
  }, [context, rowId, closeFromJS]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-8, 8])
    .shouldCancelWhenOutside(false)
    .minPointers(1)
    .maxPointers(1)
    .onStart(() => {
      contextX.value = translateX.value;
      hasTriggeredHaptic.value = false;
      
      if (context) {
        runOnJS(context.closeAllExcept)(rowId);
      }
    })
    .onUpdate((event) => {
      const newTranslateX = contextX.value + event.translationX;
      
      const maxLeft = leftActionsWidth > 0 ? leftActionsWidth + 20 : 0;
      const maxRight = rightActionsWidth > 0 ? -(rightActionsWidth + 20) : 0;
      
      translateX.value = Math.min(Math.max(newTranslateX, maxRight), maxLeft);
      
      const absTranslateX = Math.abs(translateX.value);
      if (absTranslateX >= ACTION_THRESHOLD && !hasTriggeredHaptic.value) {
        hasTriggeredHaptic.value = true;
        runOnJS(triggerHaptic)('light');
      } else if (absTranslateX < ACTION_THRESHOLD && hasTriggeredHaptic.value) {
        hasTriggeredHaptic.value = false;
      }

      if (absTranslateX >= FULL_SWIPE_THRESHOLD && !isOpen.value) {
        runOnJS(triggerHaptic)('heavy');
      }
    })
    .onEnd((event) => {
      const absTranslateX = Math.abs(translateX.value);
      const absVelocity = Math.abs(event.velocityX);
      const swipeRatio = absTranslateX / SCREEN_WIDTH;
      
      const shouldTriggerAction = 
        absTranslateX >= FULL_SWIPE_THRESHOLD && 
        swipeRatio >= MIN_SWIPE_RATIO && 
        absVelocity >= VELOCITY_THRESHOLD;
      
      if (shouldTriggerAction) {
        if (translateX.value > 0 && leftActions.length > 0) {
          const action = leftActions[leftActions.length - 1];
          runOnJS(handleActionPress)(action);
          return;
        } else if (translateX.value < 0 && rightActions.length > 0) {
          const action = rightActions[rightActions.length - 1];
          runOnJS(handleActionPress)(action);
          return;
        }
      }

      if (absTranslateX >= ACTION_THRESHOLD) {
        const targetX = translateX.value > 0 ? leftActionsWidth : -rightActionsWidth;
        translateX.value = withSpring(targetX, springConfig);
        isOpen.value = true;
        if (onOpen) {
          runOnJS(onOpen)();
        }
      } else {
        close();
      }
    });

  const rowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const leftActionsAnimatedStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      translateX.value,
      [0, leftActionsWidth],
      [0, 1],
      Extrapolation.CLAMP
    );
    
    return {
      opacity: interpolate(progress, [0, 0.3, 1], [0, 0.5, 1]),
      transform: [
        { scale: interpolate(progress, [0, 1], [0.8, 1], Extrapolation.CLAMP) },
      ],
    };
  });

  const rightActionsAnimatedStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      translateX.value,
      [-rightActionsWidth, 0],
      [1, 0],
      Extrapolation.CLAMP
    );
    
    return {
      opacity: interpolate(progress, [0, 0.3, 1], [0, 0.5, 1]),
      transform: [
        { scale: interpolate(progress, [0, 1], [0.8, 1], Extrapolation.CLAMP) },
      ],
    };
  });

  const renderActions = (actions: SwipeAction[], side: 'left' | 'right') => {
    if (actions.length === 0) return null;

    return (
      <Animated.View
        style={[
          styles.actionsContainer,
          side === 'left' ? styles.leftActions : styles.rightActions,
          side === 'left' ? leftActionsAnimatedStyle : rightActionsAnimatedStyle,
        ]}
      >
        {actions.map((action) => (
          <Pressable
            key={action.key}
            onPress={() => handleActionPress(action)}
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: action.color },
              pressed && styles.actionButtonPressed,
            ]}
          >
            {action.icon}
          </Pressable>
        ))}
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {renderActions(leftActions, 'left')}
      {renderActions(rightActions, 'right')}
      
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.rowContent, rowAnimatedStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  rowContent: {
    backgroundColor: 'transparent',
  },
  actionsContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  leftActions: {
    left: 0,
    justifyContent: 'flex-start',
  },
  rightActions: {
    right: 0,
    justifyContent: 'flex-end',
  },
  actionButton: {
    width: ACTION_WIDTH - spacing.sm,
    height: ACTION_WIDTH - spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
});

export default SwipeableRow;
