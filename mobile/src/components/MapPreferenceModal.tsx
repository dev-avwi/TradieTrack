import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useMapsStore, openMapsDirectly, openMapsAddressDirectly, MapsPreference } from '../lib/maps-store';
import { useTheme, ThemeColors } from '../lib/theme';
import { spacing, radius, shadows, typography } from '../lib/design-tokens';

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  content: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.xl,
    width: '100%',
    maxWidth: 340,
    ...shadows.xl,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.pageTitle,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  optionsContainer: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.border,
    gap: spacing.md,
  },
  optionButtonApple: {
    backgroundColor: colors.muted,
  },
  optionButtonGoogle: {
    backgroundColor: colors.muted,
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleIconBg: {
    backgroundColor: '#000',
  },
  googleIconBg: {
    backgroundColor: '#4285F4',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  optionDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.infoLight,
    gap: spacing.sm,
  },
  noteText: {
    flex: 1,
    ...typography.caption,
    color: colors.info,
    lineHeight: 18,
  },
  cancelButton: {
    marginTop: spacing.md,
    alignItems: 'center',
    padding: spacing.md,
  },
  cancelText: {
    ...typography.body,
    color: colors.mutedForeground,
  },
});

export function MapPreferenceModal() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const { 
    showPreferenceModal, 
    setShowPreferenceModal, 
    setMapsPreference,
    pendingNavigation,
    setPendingNavigation,
  } = useMapsStore();

  const handleSelect = (preference: 'apple' | 'google') => {
    setMapsPreference(preference);
    setShowPreferenceModal(false);
    
    if (pendingNavigation) {
      const { latitude, longitude, address } = pendingNavigation;
      if (latitude !== 0 && longitude !== 0) {
        openMapsDirectly(latitude, longitude, preference, address);
      } else if (address) {
        openMapsAddressDirectly(address, preference);
      }
      setPendingNavigation(null);
    }
  };

  const handleCancel = () => {
    setShowPreferenceModal(false);
    setPendingNavigation(null);
  };

  return (
    <Modal
      visible={showPreferenceModal}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Feather name="navigation" size={28} color={colors.primary} />
          </View>
          
          <Text style={styles.title}>Choose Your Maps App</Text>
          <Text style={styles.subtitle}>
            Which app would you like to use for directions?
          </Text>
          
          <View style={styles.optionsContainer}>
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.optionButton, styles.optionButtonApple]}
                onPress={() => handleSelect('apple')}
                activeOpacity={0.7}
                data-testid="button-maps-apple"
              >
                <View style={[styles.optionIconContainer, styles.appleIconBg]}>
                  <Feather name="map" size={24} color="#fff" />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Apple Maps</Text>
                  <Text style={styles.optionDescription}>Built-in iOS maps app</Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[styles.optionButton, styles.optionButtonGoogle]}
              onPress={() => handleSelect('google')}
              activeOpacity={0.7}
              data-testid="button-maps-google"
            >
              <View style={[styles.optionIconContainer, styles.googleIconBg]}>
                <Feather name="map-pin" size={24} color="#fff" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Google Maps</Text>
                <Text style={styles.optionDescription}>Google's navigation app</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.noteContainer}>
            <Feather name="info" size={14} color={colors.info} />
            <Text style={styles.noteText}>
              You can change this anytime in App Settings
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={handleCancel}
            activeOpacity={0.7}
            data-testid="button-maps-cancel"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
