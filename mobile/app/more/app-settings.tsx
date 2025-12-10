import { View, Text, ScrollView, StyleSheet, Pressable, Animated, Switch, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeMode } from '../../src/lib/theme';
import { useRef, useState, useEffect } from 'react';
import { useLocationStore, getActivityStatus, formatAccuracy } from '../../src/lib/location-store';

function ThemeModeButton({ 
  mode, 
  label, 
  icon, 
  active, 
  onPress 
}: { 
  mode: ThemeMode; 
  label: string; 
  icon: keyof typeof Feather.glyphMap;
  active: boolean; 
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
    }).start();
  };

  return (
    <Animated.View style={[{ flex: 1, transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.themeButton,
          {
            backgroundColor: active ? colors.primary : pressed ? colors.cardHover : colors.card,
            borderColor: active ? colors.primary : colors.border,
          },
        ]}
      >
        <Feather 
          name={icon} 
          size={24} 
          color={active ? colors.white : colors.foreground} 
        />
        <Text style={[
          styles.themeButtonLabel,
          { color: active ? colors.white : colors.foreground },
        ]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function AppSettingsScreen() {
  const { colors, themeMode, setThemeMode, isDark, brandColor } = useTheme();
  const { 
    isEnabled: locationEnabled, 
    status: locationStatus,
    lastLocation,
    lastGeofenceEvent,
    isMoving,
    permissionGranted,
    batteryLevel,
    errorMessage: locationError,
    enableTracking, 
    disableTracking,
    initializeTracking 
  } = useLocationStore();
  
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    initializeTracking();
  }, []);

  const handleLocationToggle = async (value: boolean) => {
    setIsToggling(true);
    try {
      if (value) {
        const success = await enableTracking();
        if (!success) {
          Alert.alert(
            'Location Permission Required',
            'To enable team location tracking, please allow location access in your device settings. This helps your team see where you are on the map.',
            [{ text: 'OK' }]
          );
        }
      } else {
        await disableTracking();
      }
    } finally {
      setIsToggling(false);
    }
  };

  const getLocationStatusText = () => {
    if (!locationEnabled) return 'Off';
    if (locationStatus === 'tracking') return 'Active';
    if (locationStatus === 'starting') return 'Starting...';
    if (locationStatus === 'error') return 'Error';
    return 'Stopped';
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'App Settings',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
        }} 
      />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Appearance</Text>
          
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Theme Mode</Text>
            <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>
              Choose how TradieTrack looks
            </Text>
            
            <View style={styles.themeButtonsRow}>
              <ThemeModeButton
                mode="light"
                label="Light"
                icon="sun"
                active={themeMode === 'light'}
                onPress={() => setThemeMode('light')}
              />
              <ThemeModeButton
                mode="dark"
                label="Dark"
                icon="moon"
                active={themeMode === 'dark'}
                onPress={() => setThemeMode('dark')}
              />
              <ThemeModeButton
                mode="system"
                label="Auto"
                icon="smartphone"
                active={themeMode === 'system'}
                onPress={() => setThemeMode('system')}
              />
            </View>
            
            <Text style={[styles.themeNote, { color: colors.mutedForeground }]}>
              {themeMode === 'system' 
                ? `Auto mode is active (currently ${isDark ? 'dark' : 'light'})`
                : `${themeMode.charAt(0).toUpperCase() + themeMode.slice(1)} mode is active`
              }
            </Text>
          </View>

          {brandColor && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Brand Color</Text>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.brandColorRow}>
                  <View style={[styles.brandColorSwatch, { backgroundColor: brandColor }]} />
                  <View style={styles.brandColorInfo}>
                    <Text style={[styles.cardTitle, { color: colors.foreground }]}>Custom Brand</Text>
                    <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>
                      Set from business settings on web
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}

          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Location Tracking</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: locationEnabled ? colors.successLight || '#dcfce7' : colors.primaryLight }]}>
                <Feather 
                  name="map-pin" 
                  size={20} 
                  color={locationEnabled ? colors.success || '#16a34a' : colors.primary} 
                />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, { color: colors.foreground }]}>Share My Location</Text>
                <Text style={[styles.settingSubtitle, { color: colors.mutedForeground }]}>
                  {getLocationStatusText()} - Let your team see where you are
                </Text>
              </View>
              <Switch
                value={locationEnabled}
                onValueChange={handleLocationToggle}
                disabled={isToggling}
                trackColor={{ false: colors.muted, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
            
            {locationEnabled && lastLocation && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.locationInfo}>
                  <View style={styles.locationInfoRow}>
                    <Feather name="activity" size={14} color={colors.mutedForeground} />
                    <Text style={[styles.locationInfoText, { color: colors.mutedForeground }]}>
                      Status: {getActivityStatus({ 
                        isEnabled: locationEnabled, 
                        status: locationStatus, 
                        lastLocation, 
                        lastGeofenceEvent,
                        batteryLevel,
                        isMoving,
                        permissionGranted,
                        errorMessage: locationError
                      })}
                    </Text>
                  </View>
                  <View style={styles.locationInfoRow}>
                    <Feather name="crosshair" size={14} color={colors.mutedForeground} />
                    <Text style={[styles.locationInfoText, { color: colors.mutedForeground }]}>
                      Accuracy: {formatAccuracy(lastLocation.accuracy)}
                    </Text>
                  </View>
                  <View style={styles.locationInfoRow}>
                    <Feather name="clock" size={14} color={colors.mutedForeground} />
                    <Text style={[styles.locationInfoText, { color: colors.mutedForeground }]}>
                      Last update: {new Date(lastLocation.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                </View>
              </>
            )}
            
            {locationError && (
              <View style={[styles.locationNote, { backgroundColor: colors.destructiveLight || '#fee2e2' }]}>
                <Feather name="alert-circle" size={14} color={colors.destructive || '#dc2626'} />
                <Text style={[styles.locationNoteText, { color: colors.destructive || '#dc2626' }]}>
                  {locationError}
                </Text>
              </View>
            )}
            
            <View style={[styles.locationNote, { backgroundColor: colors.muted }]}>
              <Feather name="info" size={14} color={colors.mutedForeground} />
              <Text style={[styles.locationNoteText, { color: colors.mutedForeground }]}>
                Location is shared with your team's map view. Updates every 30 seconds to save battery.
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Regional</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Pressable 
              style={({ pressed }) => [
                styles.settingRow,
                { backgroundColor: pressed ? colors.cardHover : 'transparent' }
              ]}
            >
              <View style={[styles.settingIcon, { backgroundColor: colors.primaryLight }]}>
                <Feather name="globe" size={20} color={colors.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, { color: colors.foreground }]}>Region</Text>
                <Text style={[styles.settingSubtitle, { color: colors.mutedForeground }]}>Australia</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>
            
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            
            <Pressable 
              style={({ pressed }) => [
                styles.settingRow,
                { backgroundColor: pressed ? colors.cardHover : 'transparent' }
              ]}
            >
              <View style={[styles.settingIcon, { backgroundColor: colors.primaryLight }]}>
                <Feather name="dollar-sign" size={20} color={colors.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, { color: colors.foreground }]}>Currency</Text>
                <Text style={[styles.settingSubtitle, { color: colors.mutedForeground }]}>AUD ($)</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>About</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: colors.primaryLight }]}>
                <Feather name="info" size={20} color={colors.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, { color: colors.foreground }]}>Version</Text>
                <Text style={[styles.settingSubtitle, { color: colors.mutedForeground }]}>1.0.0 (Beta)</Text>
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.foreground }]}>TradieTrack</Text>
            <Text style={[styles.footerSubtext, { color: colors.mutedForeground }]}>
              Made in Australia for Australian Tradies
            </Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  themeButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  themeButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    gap: 8,
  },
  themeButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  themeNote: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  brandColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandColorSwatch: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  brandColorInfo: {
    flex: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginHorizontal: 12,
  },
  locationInfo: {
    padding: 12,
    gap: 8,
  },
  locationInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationInfoText: {
    fontSize: 13,
  },
  locationNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  locationNoteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footerSubtext: {
    fontSize: 13,
    marginTop: 4,
  },
});
