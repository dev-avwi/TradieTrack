import { Tabs } from 'expo-router';
import { useTheme } from '../../src/lib/theme';

const HIDDEN_TAB_BAR = {
  display: 'none' as const,
  height: 0,
  maxHeight: 0,
  minHeight: 0,
  overflow: 'hidden' as const,
  position: 'absolute' as const,
  opacity: 0,
  bottom: -100,
};

export default function TabLayout() {
  const { colors } = useTheme();
  
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: HIDDEN_TAB_BAR,
        tabBarShowLabel: false,
        tabBarIconStyle: { display: 'none' },
        tabBarButton: () => null,
        animation: 'none',
        lazy: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Work',
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
        }}
      />
      <Tabs.Screen
        name="money"
        options={{
          title: 'Money',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'More',
        }}
      />
    </Tabs>
  );
}
