import { useMemo, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
  Modal
} from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { useAuthStore } from '../../src/lib/store';
import { spacing, radius, shadows, typography, iconSizes } from '../../src/lib/design-tokens';
import api from '../../src/lib/api';

const PRESET_COLORS = [
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Cyan', hex: '#06b6d4' },
];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.lg,
  },
  logoSection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  logoPreview: {
    width: 100,
    height: 100,
    borderRadius: radius.xl,
    backgroundColor: colors.muted,
    marginBottom: spacing.md,
  },
  logoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: radius.xl,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  logoActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  logoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
  },
  logoButtonPrimary: {
    backgroundColor: colors.primary,
  },
  logoButtonText: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '500',
  },
  logoButtonTextPrimary: {
    color: colors.primaryForeground,
  },
  logoRemoveButton: {
    backgroundColor: colors.destructiveLight,
  },
  logoRemoveButtonText: {
    color: colors.destructive,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'flex-start',
  },
  colorSwatch: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: colors.foreground,
  },
  customColorSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  customColorLabel: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  customColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  customColorInput: {
    flex: 1,
    height: 48,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  customColorPreview: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
  },
  applyButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  applyButtonText: {
    color: colors.primaryForeground,
    fontWeight: '600',
    fontSize: 15,
  },
  previewSection: {
    marginTop: spacing.lg,
  },
  previewCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  previewIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  previewTitle: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  previewSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  previewButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignSelf: 'flex-start',
    marginTop: spacing.md,
  },
  previewButtonText: {
    color: colors.primaryForeground,
    fontWeight: '600',
    fontSize: 14,
  },
  previewBadge: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  previewBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  infoText: {
    ...typography.caption,
    color: colors.mutedForeground,
    flex: 1,
  },
  currentColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  currentColorSwatch: {
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    ...shadows.md,
  },
  currentColorInfo: {
    flex: 1,
  },
  currentColorLabel: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '600',
  },
  currentColorHex: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primaryForeground,
    marginTop: 12,
  },
});

export default function BrandingScreen() {
  const { colors, brandColor } = useTheme();
  const { businessSettings, updateBusinessSettings } = useAuthStore();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [customColor, setCustomColor] = useState(brandColor || businessSettings?.primaryColor || '#3b82f6');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState(businessSettings?.logoUrl || '');

  const currentColor = brandColor || businessSettings?.primaryColor || '#3b82f6';

  const isValidHex = (hex: string) => /^#[0-9A-Fa-f]{6}$/.test(hex);

  const handlePresetSelect = useCallback((hex: string) => {
    setCustomColor(hex);
  }, []);

  const handleApplyColor = useCallback(async () => {
    if (!isValidHex(customColor)) {
      Alert.alert('Invalid Color', 'Please enter a valid hex color (e.g., #3b82f6)');
      return;
    }

    setIsSaving(true);
    try {
      const success = await updateBusinessSettings({ primaryColor: customColor });
      
      if (success) {
        Alert.alert('Success', 'Brand color updated! The new color will appear throughout the app.');
      } else {
        Alert.alert('Error', 'Failed to save brand color. Please try again.');
      }
    } catch (error) {
      console.error('Failed to save brand color:', error);
      Alert.alert('Error', 'Failed to save brand color. Please check your connection.');
    } finally {
      setIsSaving(false);
    }
  }, [customColor, updateBusinessSettings]);

  const pickImage = async (useCamera: boolean) => {
    try {
      const permissionResult = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          `Please grant ${useCamera ? 'camera' : 'photo library'} access to upload your logo.`
        );
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const uploadImage = async (asset: ImagePicker.ImagePickerAsset) => {
    setIsUploadingLogo(true);

    try {
      const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://ff735932-1a5e-42dc-89e5-b025f7feea5d-00-3hwzylsjthmgp.worf.replit.dev';
      const token = await api.getToken();
      
      const filename = `logo-${Date.now()}.${asset.uri.split('.').pop() || 'jpg'}`;
      const mimeType = asset.mimeType || 'image/jpeg';

      const paramsResponse = await fetch(`${API_BASE}/api/objects/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          filename,
          contentType: mimeType,
          directory: 'public/logos',
        }),
      });

      if (!paramsResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { url, method, publicUrl } = await paramsResponse.json();

      const fileResponse = await fetch(asset.uri);
      const blob = await fileResponse.blob();

      const uploadResponse = await fetch(url, {
        method: method || 'PUT',
        headers: {
          'Content-Type': mimeType,
        },
        body: blob,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      const logoResponse = await fetch(`${API_BASE}/api/logo`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ logoUrl: publicUrl }),
      });

      if (logoResponse.ok) {
        const logoData = await logoResponse.json();
        setLogoUrl(publicUrl);
        
        if (logoData.extractedColor) {
          setCustomColor(logoData.extractedColor);
        }
        
        await updateBusinessSettings({ logoUrl: publicUrl });
        Alert.alert('Success', 'Logo uploaded successfully!');
      } else {
        setLogoUrl(publicUrl);
        await updateBusinessSettings({ logoUrl: publicUrl });
        Alert.alert('Success', 'Logo uploaded successfully!');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Failed', 'Could not upload your logo. Please try again.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    Alert.alert(
      'Remove Logo',
      'Are you sure you want to remove your business logo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setLogoUrl('');
            await updateBusinessSettings({ logoUrl: '' });
          },
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Branding',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
        }} 
      />
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Business Logo</Text>
          <View style={styles.card}>
            <View style={styles.logoSection}>
              {logoUrl ? (
                <View>
                  <Image source={{ uri: logoUrl }} style={styles.logoPreview} />
                  {isUploadingLogo && (
                    <View style={[styles.uploadOverlay, { width: 100, height: 100 }]}>
                      <ActivityIndicator size="large" color={colors.primaryForeground} />
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.logoPlaceholder}>
                  {isUploadingLogo ? (
                    <ActivityIndicator size="large" color={colors.primary} />
                  ) : (
                    <Feather name="image" size={32} color={colors.mutedForeground} />
                  )}
                </View>
              )}
              
              <View style={styles.logoActions}>
                <TouchableOpacity
                  style={[styles.logoButton, styles.logoButtonPrimary]}
                  onPress={() => pickImage(false)}
                  disabled={isUploadingLogo}
                >
                  <Feather name="upload" size={16} color={colors.primaryForeground} />
                  <Text style={[styles.logoButtonText, styles.logoButtonTextPrimary]}>
                    {logoUrl ? 'Change' : 'Upload'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.logoButton}
                  onPress={() => pickImage(true)}
                  disabled={isUploadingLogo}
                >
                  <Feather name="camera" size={16} color={colors.foreground} />
                  <Text style={styles.logoButtonText}>Camera</Text>
                </TouchableOpacity>
                
                {logoUrl && (
                  <TouchableOpacity
                    style={[styles.logoButton, styles.logoRemoveButton]}
                    onPress={handleRemoveLogo}
                    disabled={isUploadingLogo}
                  >
                    <Feather name="trash-2" size={16} color={colors.destructive} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <Feather name="info" size={14} color={colors.mutedForeground} />
              <Text style={styles.infoText}>
                Upload a square logo for best results. Appears on quotes, invoices, and documents.
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Current Brand Color</Text>
          <View style={styles.card}>
            <View style={styles.currentColorRow}>
              <View style={[styles.currentColorSwatch, { backgroundColor: currentColor }]} />
              <View style={styles.currentColorInfo}>
                <Text style={styles.currentColorLabel}>Your Brand Color</Text>
                <Text style={styles.currentColorHex}>{currentColor.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Choose a Color</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Preset Colors</Text>
            <Text style={styles.cardSubtitle}>
              Select a color that represents your business
            </Text>
            
            <View style={styles.colorGrid}>
              {PRESET_COLORS.map((color) => (
                <TouchableOpacity
                  key={color.hex}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color.hex },
                    customColor === color.hex && styles.colorSwatchSelected,
                  ]}
                  onPress={() => handlePresetSelect(color.hex)}
                  activeOpacity={0.8}
                >
                  {customColor === color.hex && (
                    <Feather name="check" size={20} color={colors.primaryForeground} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.customColorSection}>
              <Text style={styles.customColorLabel}>Custom Color</Text>
              <View style={styles.customColorRow}>
                <TextInput
                  style={styles.customColorInput}
                  value={customColor}
                  onChangeText={setCustomColor}
                  placeholder="#3b82f6"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  maxLength={7}
                />
                <View 
                  style={[
                    styles.customColorPreview, 
                    { backgroundColor: isValidHex(customColor) ? customColor : colors.muted }
                  ]} 
                />
              </View>
              
              <TouchableOpacity
                style={[styles.applyButton, isSaving && { opacity: 0.7 }]}
                onPress={handleApplyColor}
                disabled={isSaving}
                activeOpacity={0.8}
              >
                <Text style={styles.applyButtonText}>
                  {isSaving ? 'Saving...' : 'Apply Color'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Live Preview</Text>
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View style={[styles.previewIcon, { backgroundColor: `${customColor}20` }]}>
                <Feather name="briefcase" size={20} color={customColor} />
              </View>
              <View>
                <Text style={styles.previewTitle}>Sample Job Card</Text>
                <Text style={styles.previewSubtitle}>This is how your brand looks</Text>
              </View>
            </View>
            <View style={[styles.previewBadge, { backgroundColor: `${customColor}20` }]}>
              <Text style={[styles.previewBadgeText, { color: customColor }]}>In Progress</Text>
            </View>
            <TouchableOpacity 
              style={[styles.previewButton, { backgroundColor: customColor }]}
              activeOpacity={0.8}
            >
              <Text style={styles.previewButtonText}>Primary Button</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoRow}>
            <Feather name="info" size={16} color={colors.mutedForeground} />
            <Text style={styles.infoText}>
              Your brand color will be applied throughout the app including buttons, badges, and accent elements.
            </Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
