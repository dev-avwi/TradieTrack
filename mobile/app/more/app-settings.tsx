import { View, Text, ScrollView, StyleSheet, Pressable, Switch, Alert, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeMode } from '../../src/lib/theme';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocationStore, getActivityStatus, formatAccuracy } from '../../src/lib/location-store';
import { useOfflineStore } from '../../src/lib/offline-storage';
import offlineStorage from '../../src/lib/offline-storage';
import { useAuthStore } from '../../src/lib/store';
import api from '../../src/lib/api';
import { spacing, radius, typography } from '../../src/lib/design-tokens';
import { useMapsStore, MapsPreference } from '../../src/lib/maps-store';

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

interface ColorOption {
  color: string;
  available: boolean;
  isCurrentUser: boolean;
}

interface ColorAvailabilityResponse {
  colors: ColorOption[];
  currentColor: string | null;
  usedCount: number;
  availableCount: number;
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: spacing.md,
    padding: spacing.xs,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    ...typography.pageTitle,
    color: colors.foreground,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    ...typography.label,
    color: colors.foreground,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  settingItemPressed: {
    backgroundColor: colors.cardHover,
  },
  settingIconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  settingDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  settingValue: {
    ...typography.body,
    color: colors.mutedForeground,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 68,
  },
  themeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.muted,
  },
  themeOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  themeOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  themeOptionLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.foreground,
  },
  themeOptionLabelActive: {
    color: colors.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...typography.captionSmall,
    fontWeight: '500',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  infoText: {
    flex: 1,
    ...typography.caption,
    lineHeight: 18,
  },
  colorPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  colorAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  colorAvatarInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  colorInfo: {
    flex: 1,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: spacing.lg,
    paddingTop: 0,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncStats: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
  },
  syncStat: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
  },
  syncStatValue: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  syncStatLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  syncActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    paddingTop: 0,
  },
  syncButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  syncButtonText: {
    ...typography.body,
    fontWeight: '600',
  },
  outlineButton: {
    borderWidth: 1,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.lg,
  },
  footerLogo: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  footerTitle: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  footerSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  footerVersion: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: spacing.md,
  },
  mapsOptionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  mapsOption: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.muted,
  },
  mapsOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  mapsOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  mapsOptionLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.foreground,
  },
  mapsOptionLabelActive: {
    color: colors.primary,
  },
});

function MapsPreferenceSection() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { mapsPreference, setMapsPreference } = useMapsStore();

  const options: { value: MapsPreference; icon: string; label: string; bgColor: string }[] = [
    ...(Platform.OS === 'ios' ? [{ value: 'apple' as MapsPreference, icon: 'map', label: 'Apple Maps', bgColor: '#000' }] : []),
    { value: 'google' as MapsPreference, icon: 'map-pin', label: 'Google Maps', bgColor: '#4285F4' },
  ];

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: colors.infoLight }]}>
          <Feather name="navigation" size={16} color={colors.info} />
        </View>
        <Text style={styles.sectionTitle}>Maps Preference</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.mapsOptionRow}>
          {options.map(({ value, icon, label, bgColor }) => (
            <TouchableOpacity
              key={value || 'none'}
              style={[styles.mapsOption, mapsPreference === value && styles.mapsOptionActive]}
              onPress={() => setMapsPreference(value)}
              activeOpacity={0.7}
              data-testid={`button-maps-pref-${value}`}
            >
              <View style={[
                styles.mapsOptionIcon,
                { backgroundColor: mapsPreference === value ? bgColor : colors.mutedForeground + '20' }
              ]}>
                <Feather
                  name={icon as any}
                  size={22}
                  color={mapsPreference === value ? '#fff' : colors.mutedForeground}
                />
              </View>
              <Text style={[
                styles.mapsOptionLabel,
                mapsPreference === value && styles.mapsOptionLabelActive
              ]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {!mapsPreference && (
          <View style={[styles.infoBox, { marginHorizontal: spacing.lg, marginBottom: spacing.lg, marginTop: 0 }]}>
            <Feather name="info" size={14} color={colors.info} />
            <Text style={[styles.infoText, { color: colors.info }]}>
              Your preference will be saved when you first open directions
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function AppSettingsScreen() {
  const { colors, themeMode, setThemeMode, isDark, brandColor } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, setUser } = useAuthStore();
  
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
  
  const { isOnline, isSyncing, pendingSyncCount, lastSyncTime, syncError, isInitialized } = useOfflineStore();
  
  const [isToggling, setIsToggling] = useState(false);
  const [isFullSyncing, setIsFullSyncing] = useState(false);
  const [colorOptions, setColorOptions] = useState<ColorOption[]>([]);
  const [isLoadingColors, setIsLoadingColors] = useState(true);
  const [isSavingColor, setIsSavingColor] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(user?.themeColor || null);

  useEffect(() => {
    initializeTracking();
    loadAvailableColors();
  }, []);

  const loadAvailableColors = useCallback(async () => {
    try {
      const response = await api.request<ColorAvailabilityResponse>('GET', '/api/team/colors/available');
      if (response.data) {
        setColorOptions(response.data.colors);
        if (response.data.currentColor) {
          setSelectedColor(response.data.currentColor);
        }
      }
    } catch (error) {
      console.log('Failed to load colors:', error);
    } finally {
      setIsLoadingColors(false);
    }
  }, []);

  const handleLocationToggle = async (value: boolean) => {
    setIsToggling(true);
    try {
      if (value) {
        const success = await enableTracking();
        if (!success) {
          Alert.alert(
            'Location Permission Required',
            'Allow location access in your device settings to enable team tracking.',
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
      'This removes cached data from your device. Server data stays safe.',
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

  const handleColorSelect = async (colorHex: string, isAvailable: boolean) => {
    if (!isAvailable) return;
    
    setSelectedColor(colorHex);
    setIsSavingColor(true);
    
    try {
      const response = await api.request<{ success: boolean }>('PATCH', '/api/user/theme-color', { themeColor: colorHex });
      if (response.data?.success && user) {
        setUser({ ...user, themeColor: colorHex });
        await loadAvailableColors();
      }
    } catch (error) {
      setSelectedColor(user?.themeColor || null);
      Alert.alert('Error', 'Failed to save your map color.');
    } finally {
      setIsSavingColor(false);
    }
  };

  const getLocationStatusText = () => {
    if (!locationEnabled) return 'Off';
    if (locationStatus === 'tracking') return 'Active';
    if (locationStatus === 'starting') return 'Starting...';
    if (locationStatus === 'error') return 'Error';
    return 'Stopped';
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    const diff = Date.now() - lastSyncTime;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(lastSyncTime).toLocaleDateString();
  };

  const initials = user 
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'
    : 'U';

  const getColorOption = (hex: string) => colorOptions.find(opt => opt.color.toLowerCase() === hex.toLowerCase());

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>App Settings</Text>
              <Text style={styles.headerSubtitle}>Customize your experience</Text>
            </View>
          </View>

          {/* Appearance Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.primaryLight }]}>
                <Feather name="sun" size={16} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>Appearance</Text>
            </View>
            <View style={styles.card}>
              <View style={styles.themeRow}>
                {[
                  { mode: 'light' as ThemeMode, icon: 'sun', label: 'Light' },
                  { mode: 'dark' as ThemeMode, icon: 'moon', label: 'Dark' },
                  { mode: 'system' as ThemeMode, icon: 'smartphone', label: 'Auto' },
                ].map(({ mode, icon, label }) => (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.themeOption, themeMode === mode && styles.themeOptionActive]}
                    onPress={() => setThemeMode(mode)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.themeOptionIcon, 
                      { backgroundColor: themeMode === mode ? colors.primary : colors.mutedForeground + '20' }
                    ]}>
                      <Feather 
                        name={icon as any} 
                        size={22} 
                        color={themeMode === mode ? '#fff' : colors.mutedForeground} 
                      />
                    </View>
                    <Text style={[
                      styles.themeOptionLabel,
                      themeMode === mode && styles.themeOptionLabelActive
                    ]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Map Identity Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.infoLight }]}>
                <Feather name="map-pin" size={16} color={colors.info} />
              </View>
              <Text style={styles.sectionTitle}>Map Identity</Text>
            </View>
            <View style={styles.card}>
              <View style={styles.colorPreview}>
                <View style={[styles.colorAvatar, { backgroundColor: selectedColor || colors.primary }]}>
                  <Text style={styles.colorAvatarInitials}>{initials}</Text>
                </View>
                <View style={styles.colorInfo}>
                  <Text style={styles.settingTitle}>{user?.firstName} {user?.lastName}</Text>
                  <Text style={styles.settingDescription}>
                    {selectedColor ? MAP_COLORS.find(c => c.hex.toLowerCase() === selectedColor.toLowerCase())?.name || 'Custom' : 'Select a color'}
                  </Text>
                </View>
                {isSavingColor && <ActivityIndicator size="small" color={colors.primary} />}
              </View>
              
              {isLoadingColors ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ padding: spacing.lg }} />
              ) : (
                <View style={styles.colorGrid}>
                  {MAP_COLORS.map((color) => {
                    const opt = getColorOption(color.hex);
                    const isAvailable = opt ? opt.available : colorOptions.length === 0;
                    const isCurrentUser = opt?.isCurrentUser ?? false;
                    const isSelected = selectedColor?.toLowerCase() === color.hex.toLowerCase();
                    const isTaken = colorOptions.length > 0 && !isAvailable && !isCurrentUser;
                    
                    return (
                      <TouchableOpacity
                        key={color.hex}
                        style={[
                          styles.colorOption,
                          { backgroundColor: color.hex },
                          isSelected && styles.colorOptionSelected,
                          isTaken && styles.colorOptionTaken,
                        ]}
                        onPress={() => handleColorSelect(color.hex, isAvailable || isCurrentUser)}
                        disabled={isTaken || isSavingColor}
                        activeOpacity={0.7}
                      >
                        {isSelected && <Feather name="check" size={18} color="#fff" />}
                        {isTaken && (
                          <View style={styles.takenOverlay}>
                            <Feather name="x" size={14} color="#fff" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>

          {/* Location Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.successLight }]}>
                <Feather name="navigation" size={16} color={colors.success} />
              </View>
              <Text style={styles.sectionTitle}>Location Sharing</Text>
            </View>
            <View style={styles.card}>
              <View style={styles.settingItem}>
                <View style={[styles.settingIconCircle, { backgroundColor: locationEnabled ? colors.successLight : colors.muted }]}>
                  <Feather 
                    name={locationEnabled ? 'navigation' : 'navigation-2'} 
                    size={20} 
                    color={locationEnabled ? colors.success : colors.mutedForeground} 
                  />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Share Location</Text>
                  <Text style={styles.settingDescription}>
                    {locationEnabled ? getLocationStatusText() : 'Let your team see where you are'}
                  </Text>
                </View>
                <Switch
                  value={locationEnabled}
                  onValueChange={handleLocationToggle}
                  disabled={isToggling}
                  trackColor={{ false: colors.muted, true: colors.success }}
                  thumbColor={colors.white}
                />
              </View>
              
              {locationEnabled && lastLocation && (
                <>
                  <View style={styles.divider} />
                  <View style={[styles.settingItem, { paddingVertical: spacing.sm }]}>
                    <View style={[styles.settingIconCircle, { backgroundColor: colors.muted, width: 32, height: 32 }]}>
                      <Feather name="activity" size={14} color={colors.mutedForeground} />
                    </View>
                    <View style={styles.settingContent}>
                      <Text style={styles.settingDescription}>
                        {getActivityStatus({ 
                          isEnabled: locationEnabled, 
                          status: locationStatus, 
                          lastLocation, 
                          lastGeofenceEvent,
                          batteryLevel,
                          isMoving,
                          permissionGranted,
                          errorMessage: locationError
                        })} • Accuracy: {formatAccuracy(lastLocation.accuracy)}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
            
            {locationError && (
              <View style={[styles.infoBox, { backgroundColor: colors.destructiveLight }]}>
                <Feather name="alert-circle" size={14} color={colors.destructive} />
                <Text style={[styles.infoText, { color: colors.destructive }]}>{locationError}</Text>
              </View>
            )}
          </View>

          {/* Maps Preference Section */}
          <MapsPreferenceSection />

          {/* Data & Sync Section */}
          {isInitialized && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: colors.warningLight }]}>
                  <Feather name="refresh-cw" size={16} color={colors.warning} />
                </View>
                <Text style={styles.sectionTitle}>Data & Sync</Text>
              </View>
              <View style={styles.card}>
                <View style={styles.syncStats}>
                  <View style={styles.syncStat}>
                    <View style={[
                      styles.statusBadge, 
                      { backgroundColor: isOnline ? colors.successLight : colors.muted }
                    ]}>
                      <View style={[styles.statusDot, { backgroundColor: isOnline ? colors.success : colors.mutedForeground }]} />
                      <Text style={[styles.statusText, { color: isOnline ? colors.success : colors.mutedForeground }]}>
                        {isOnline ? 'Online' : 'Offline'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.syncStat}>
                    <Text style={styles.syncStatValue}>{formatLastSync()}</Text>
                    <Text style={styles.syncStatLabel}>Last Sync</Text>
                  </View>
                  {pendingSyncCount > 0 && (
                    <View style={styles.syncStat}>
                      <Text style={[styles.syncStatValue, { color: colors.warning }]}>{pendingSyncCount}</Text>
                      <Text style={styles.syncStatLabel}>Pending</Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.syncActions}>
                  <TouchableOpacity
                    style={[
                      styles.syncButton,
                      { backgroundColor: isOnline && !isSyncing && !isFullSyncing ? colors.primary : colors.muted }
                    ]}
                    onPress={handleSync}
                    disabled={!isOnline || isSyncing || isFullSyncing}
                    activeOpacity={0.7}
                  >
                    {(isSyncing || isFullSyncing) ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Feather name="refresh-cw" size={16} color={isOnline ? colors.white : colors.mutedForeground} />
                    )}
                    <Text style={[styles.syncButtonText, { color: isOnline ? colors.white : colors.mutedForeground }]}>
                      {(isSyncing || isFullSyncing) ? 'Syncing...' : 'Sync Now'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.syncButton, styles.outlineButton, { borderColor: colors.border }]}
                    onPress={handleClearCache}
                    activeOpacity={0.7}
                  >
                    <Feather name="trash-2" size={16} color={colors.mutedForeground} />
                    <Text style={[styles.syncButtonText, { color: colors.mutedForeground }]}>Clear</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {syncError && (
                <View style={[styles.infoBox, { backgroundColor: colors.destructiveLight }]}>
                  <Feather name="alert-circle" size={14} color={colors.destructive} />
                  <Text style={[styles.infoText, { color: colors.destructive }]}>{syncError}</Text>
                </View>
              )}
            </View>
          )}

          {/* Regional Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.muted }]}>
                <Feather name="globe" size={16} color={colors.mutedForeground} />
              </View>
              <Text style={styles.sectionTitle}>Regional</Text>
            </View>
            <View style={styles.card}>
              <View style={styles.settingItem}>
                <View style={[styles.settingIconCircle, { backgroundColor: colors.primaryLight }]}>
                  <Feather name="flag" size={20} color={colors.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Region</Text>
                  <Text style={styles.settingDescription}>Australia</Text>
                </View>
                <Text style={styles.settingValue}>AU</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.settingItem}>
                <View style={[styles.settingIconCircle, { backgroundColor: colors.successLight }]}>
                  <Feather name="dollar-sign" size={20} color={colors.success} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Currency</Text>
                  <Text style={styles.settingDescription}>Australian Dollar</Text>
                </View>
                <Text style={styles.settingValue}>AUD</Text>
              </View>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerLogo}>
              <Feather name="tool" size={24} color="#fff" />
            </View>
            <Text style={styles.footerTitle}>TradieTrack</Text>
            <Text style={styles.footerSubtitle}>Made in Australia for Australian Tradies</Text>
            <Text style={styles.footerVersion}>Version 1.0.0</Text>
          </View>
        </ScrollView>
      </View>
    </>
  );
}
