import { Tabs } from 'expo-router';
import { useTheme } from '../../src/lib/theme';

export default function TabLayout() {
  const { colors } = useTheme();
  
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
        animation: 'shift',
      }}
      sceneContainerStyle={{
        backgroundColor: colors.background,
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
      <Tabs.Screen
        name="collect"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
