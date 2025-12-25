import { ReactNode } from 'react';
import { ViewStyle, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutDown,
  SlideInRight,
  SlideOutLeft,
  ZoomIn,
  ZoomOut,
  withSpring,
  WithSpringConfig,
} from 'react-native-reanimated';
import { motion } from '../../lib/design-tokens';

type EnteringAnimation = 'fade' | 'slideUp' | 'slideRight' | 'scale';
type ExitingAnimation = 'fade' | 'slideDown' | 'slideLeft' | 'scale';

interface PageTransitionProps {
  children: ReactNode;
  entering?: EnteringAnimation;
  exiting?: ExitingAnimation;
  delay?: number;
  style?: ViewStyle;
}

const springConfig: WithSpringConfig = {
  damping: motion.springDefault.damping,
  stiffness: motion.springDefault.stiffness,
};

function getEnteringAnimation(type: EnteringAnimation, delay: number) {
  const baseDelay = delay;
  
  switch (type) {
    case 'fade':
      return FadeIn.delay(baseDelay)
        .duration(motion.normal)
        .springify()
        .damping(springConfig.damping!)
        .stiffness(springConfig.stiffness!);
    
    case 'slideUp':
      return SlideInUp.delay(baseDelay)
        .springify()
        .damping(springConfig.damping!)
        .stiffness(springConfig.stiffness!)
        .withInitialValues({ transform: [{ translateY: 20 }], opacity: 0 });
    
    case 'slideRight':
      return SlideInRight.delay(baseDelay)
        .springify()
        .damping(springConfig.damping!)
        .stiffness(springConfig.stiffness!);
    
    case 'scale':
      return ZoomIn.delay(baseDelay)
        .springify()
        .damping(springConfig.damping!)
        .stiffness(springConfig.stiffness!)
        .withInitialValues({ transform: [{ scale: 0.95 }], opacity: 0 });
    
    default:
      return FadeIn.delay(baseDelay)
        .duration(motion.normal)
        .springify()
        .damping(springConfig.damping!)
        .stiffness(springConfig.stiffness!);
  }
}

function getExitingAnimation(type: ExitingAnimation, delay: number) {
  const baseDelay = delay;
  
  switch (type) {
    case 'fade':
      return FadeOut.delay(baseDelay)
        .duration(motion.fast);
    
    case 'slideDown':
      return SlideOutDown.delay(baseDelay)
        .springify()
        .damping(springConfig.damping!)
        .stiffness(springConfig.stiffness!);
    
    case 'slideLeft':
      return SlideOutLeft.delay(baseDelay)
        .springify()
        .damping(springConfig.damping!)
        .stiffness(springConfig.stiffness!);
    
    case 'scale':
      return ZoomOut.delay(baseDelay)
        .springify()
        .damping(springConfig.damping!)
        .stiffness(springConfig.stiffness!);
    
    default:
      return FadeOut.delay(baseDelay)
        .duration(motion.fast);
  }
}

export function PageTransition({
  children,
  entering = 'slideUp',
  exiting = 'fade',
  delay = 0,
  style,
}: PageTransitionProps) {
  const enteringAnimation = getEnteringAnimation(entering, delay);
  const exitingAnimation = getExitingAnimation(exiting, delay);

  return (
    <Animated.View
      entering={enteringAnimation}
      exiting={exitingAnimation}
      style={[styles.container, style]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export type { PageTransitionProps, EnteringAnimation, ExitingAnimation };
export default PageTransition;
