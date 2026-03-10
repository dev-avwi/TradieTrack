import { Tabs } from 'expo-router';
import { useTheme } from '../../src/lib/theme';

export default function TabLayout() {
  const { colors } = useTheme();
  
  return (
    <Tabs
      tabBar={() => null}
      safeAreaInsets={{ bottom: 0, top: 0, left: 0, right: 0 }}
      sceneContainerStyle={{ backgroundColor: 'transparent' }}
      screenOptions={{
        headerShown: false,
        animation: 'none',
        lazy: true,
        sceneStyle: { backgroundColor: 'transparent' },
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
