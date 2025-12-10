import { View, Text, ScrollView, StyleSheet, Pressable, Animated, Switch, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeMode } from '../../src/lib/theme';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useLocationStore, getActivityStatus, formatAccuracy } from '../../src/lib/location-store';
import { useOfflineStore } from '../../src/lib/offline-storage';
import offlineStorage from '../../src/lib/offline-storage';
import { useAuthStore } from '../../src/lib/store';
import { apiRequest } from '../../src/lib/api';

const MAP_COLORS = [
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Lime', hex: '#84cc16' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Rose', hex: '#f43f5e' },
];

interface TeamMemberColor {
  userId: string;
  themeColor: string | null;
  firstName?: string;
  lastName?: string;
}

function MapColorSection({ colors }: { colors: any }) {
  const { user, setUser } = useAuthStore();
  const [availableColors, setAvailableColors] = useState<string[]>([]);
  const [takenColors, setTakenColors] = useState<{ [color: string]: string }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(user?.themeColor || null);
  
  const loadAvailableColors = useCallback(async () => {
    try {
      const response = await apiRequest('GET', '/api/team/colors/available');
      const data = await response.json() as { availableColors: string[], teamColors: TeamMemberColor[] };
      
      setAvailableColors(data.availableColors);
      
      const taken: { [color: string]: string } = {};
      data.teamColors.forEach((member: TeamMemberColor) => {
        if (member.themeColor && member.userId !== user?.id) {
          const name = member.firstName && member.lastName 
            ? `${member.firstName} ${member.lastName}` 
            : 'Team member';
          taken[member.themeColor.toLowerCase()] = name;
        }
      });
      setTakenColors(taken);
    } catch (error) {
      console.error('Failed to load available colors:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);
  
  useEffect(() => {
    loadAvailableColors();
  }, [loadAvailableColors]);
  
  const handleColorSelect = async (color: string) => {
    if (takenColors[color.toLowerCase()]) return;
    
    setSelectedColor(color);
    setIsSaving(true);
    
    try {
      const response = await apiRequest('PATCH', '/api/user/theme-color', { themeColor: color });
      const data = await response.json();
      
      if (data.success && user) {
        setUser({ ...user, themeColor: color });
        await loadAvailableColors();
      }
    } catch (error) {
      console.error('Failed to save theme color:', error);
      setSelectedColor(user?.themeColor || null);
      Alert.alert('Error', 'Failed to save your map color. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  const initials = user 
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'
    : 'U';
  
  return (
    <>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Map Identity</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Your Map Color</Text>
        <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>
          Choose a unique color to identify yourself on the team map
        </Text>
        
        <View style={styles.previewContainer}>
          <View style={[styles.mapPreview, { backgroundColor: selectedColor || colors.primary }]}>
            <Text style={styles.mapPreviewInitials}>{initials}</Text>
          </View>
          <View style={styles.previewInfo}>
            <Text style={[styles.previewName, { color: colors.foreground }]}>
              {user?.firstName} {user?.lastName}
            </Text>
            <Text style={[styles.previewSubtext, { color: colors.mutedForeground }]}>
              {selectedColor ? `${MAP_COLORS.find(c => c.hex.toLowerCase() === selectedColor.toLowerCase())?.name || 'Custom'}` : 'No color selected'}
            </Text>
          </View>
        </View>
        
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 16 }} />
        ) : (
          <View style={styles.colorGrid}>
            {MAP_COLORS.map((color) => {
              const isTaken = !!takenColors[color.hex.toLowerCase()];
              const isSelected = selectedColor?.toLowerCase() === color.hex.toLowerCase();
              
              return (
                <TouchableOpacity
                  key={color.hex}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color.hex },
                    isSelected && styles.colorOptionSelected,
                    isTaken && styles.colorOptionTaken,
                  ]}
                  onPress={() => handleColorSelect(color.hex)}
                  disabled={isTaken || isSaving}
                  activeOpacity={0.7}
                >
                  {isSelected && (
                    <Feather name="check" size={20} color="#fff" />
                  )}
                  {isTaken && (
                    <View style={styles.takenOverlay}>
                      <Feather name="x" size={16} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        
        {Object.keys(takenColors).length > 0 && (
          <View style={[styles.locationNote, { backgroundColor: colors.muted }]}>
            <Feather name="info" size={14} color={colors.mutedForeground} />
            <Text style={[styles.locationNoteText, { color: colors.mutedForeground }]}>
              Greyed out colors are already taken by other team members.
            </Text>
          </View>
        )}
      </View>
    </>
  );
}

function DataSyncSection({ colors }: { colors: any }) {
  const { isOnline, isSyncing, pendingSyncCount, lastSyncTime, syncError, isInitialized } = useOfflineStore();
  const [isFullSyncing, setIsFullSyncing] = useState(false);
  
  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    const diff = Date.now() - lastSyncTime;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return new Date(lastSyncTime).toLocaleDateString();
  };
  
  const handleSync = async () => {
    if (!isOnline || isSyncing || isFullSyncing) return;
    setIsFullSyncing(true);
    try {
      await offlineStorage.fullSync();
    } finally {
      setIsFullSyncing(false);
    }
  };
  
  const handleClearCache = () => {
    Alert.alert(
      'Clear Local Data?',
      'This will remove cached data from your device. Your data on the server will not be affected. The app will re-download everything when you\'re online.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            await offlineStorage.clearCache();
            Alert.alert('Done', 'Local cache cleared');
          }
        },
      ]
    );
  };
  
  if (!isInitialized) {
    return null;
  }
  
  return (
    <>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Data & Sync</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.settingRow}>
          <View style={[styles.settingIcon, { backgroundColor: isOnline ? (colors.successLight || '#dcfce7') : colors.muted }]}>
            <Feather 
              name={isOnline ? 'wifi' : 'wifi-off'} 
              size={20} 
              color={isOnline ? (colors.success || '#16a34a') : colors.mutedForeground} 
            />
          </View>
          <View style={styles.settingContent}>
            <Text style={[styles.settingTitle, { color: colors.foreground }]}>Connection</Text>
            <Text style={[styles.settingSubtitle, { color: colors.mutedForeground }]}>
              {isOnline ? 'Online' : 'Offline - changes will sync when back online'}
            </Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? (colors.success || '#16a34a') : colors.mutedForeground }]} />
        </View>
        
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        
        <View style={styles.settingRow}>
          <View style={[styles.settingIcon, { backgroundColor: colors.primaryLight }]}>
            <Feather name="refresh-cw" size={20} color={colors.primary} />
          </View>
          <View style={styles.settingContent}>
            <Text style={[styles.settingTitle, { color: colors.foreground }]}>Last Synced</Text>
            <Text style={[styles.settingSubtitle, { color: colors.mutedForeground }]}>
              {formatLastSync()}
            </Text>
          </View>
        </View>
        
        {pendingSyncCount > 0 && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: '#fef3c7' }]}>
                <Feather name="upload-cloud" size={20} color="#f59e0b" />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, { color: colors.foreground }]}>Pending Changes</Text>
                <Text style={[styles.settingSubtitle, { color: '#f59e0b' }]}>
                  {pendingSyncCount} change{pendingSyncCount !== 1 ? 's' : ''} waiting to sync
                </Text>
              </View>
            </View>
          </>
        )}
        
        {syncError && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={[styles.locationNote, { backgroundColor: colors.destructiveLight || '#fee2e2' }]}>
              <Feather name="alert-circle" size={14} color={colors.destructive || '#dc2626'} />
              <Text style={[styles.locationNoteText, { color: colors.destructive || '#dc2626' }]}>
                {syncError}
              </Text>
            </View>
          </>
        )}
        
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        
        <View style={styles.syncButtonsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.syncButton,
              { 
                backgroundColor: (!isOnline || isSyncing || isFullSyncing) 
                  ? colors.muted 
                  : pressed ? colors.primaryLight : colors.primary 
              }
            ]}
            onPress={handleSync}
            disabled={!isOnline || isSyncing || isFullSyncing}
          >
            {(isSyncing || isFullSyncing) ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Feather name="refresh-cw" size={16} color={isOnline ? colors.white : colors.mutedForeground} />
            )}
            <Text style={[
              styles.syncButtonText,
              { color: isOnline ? colors.white : colors.mutedForeground }
            ]}>
              {(isSyncing || isFullSyncing) ? 'Syncing...' : 'Sync Now'}
            </Text>
          </Pressable>
          
          <Pressable
            style={({ pressed }) => [
              styles.clearCacheButton,
              { 
                backgroundColor: pressed ? colors.cardHover : 'transparent',
                borderColor: colors.border 
              }
            ]}
            onPress={handleClearCache}
          >
            <Feather name="trash-2" size={16} color={colors.mutedForeground} />
            <Text style={[styles.clearCacheText, { color: colors.mutedForeground }]}>Clear Cache</Text>
          </Pressable>
        </View>
        
        <View style={[styles.locationNote, { backgroundColor: colors.muted }]}>
          <Feather name="info" size={14} color={colors.mutedForeground} />
          <Text style={[styles.locationNoteText, { color: colors.mutedForeground }]}>
            Offline mode keeps your jobs, clients, quotes and invoices available even without internet.
          </Text>
        </View>
      </View>
    </>
  );
}

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

          <MapColorSection colors={colors} />

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

          <DataSyncSection colors={colors} />

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
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  syncButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 8,
  },
  syncButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  syncButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  clearCacheButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  clearCacheText: {
    fontSize: 14,
    fontWeight: '500',
  },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  mapPreview: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  mapPreviewInitials: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: 16,
    fontWeight: '600',
  },
  previewSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  colorOptionTaken: {
    opacity: 0.35,
  },
  takenOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
