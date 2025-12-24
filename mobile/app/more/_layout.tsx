import { Stack } from 'expo-router';
import { useTheme } from '../../src/lib/theme';
import { IOSBackButton } from '../../src/components/ui/IOSBackButton';
import { getNavigationConfig } from '../../src/lib/platform';

export default function MoreLayout() {
  const { colors } = useTheme();
  const navigationConfig = getNavigationConfig(colors);
  
  return (
    <Stack
      screenOptions={{
        ...navigationConfig,
        headerBackVisible: false,
        headerLeft: () => <IOSBackButton />,
        headerTitle: '',
        contentStyle: {
          backgroundColor: colors.background,
        },
        animationDuration: 220,
        presentation: 'card',
        freezeOnBlur: true,
      }}
    />
  );
}
