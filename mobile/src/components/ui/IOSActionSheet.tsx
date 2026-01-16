/**
 * Native iOS Action Sheet Component
 * Uses native UIActionSheet on iOS for authentic Apple experience
 * Uses @expo/react-native-action-sheet which provides:
 * - Native UIActionSheet on iOS
 * - Cross-platform JS fallback on Android/Web (unchanged behavior)
 * 
 * This is the recommended approach per Expo docs - the library handles
 * platform differences internally while providing consistent API.
 */
import { useActionSheet, ActionSheetOptions } from '@expo/react-native-action-sheet';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { isIOS } from '../../lib/device';

interface ActionSheetOption {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface UseIOSActionSheetOptions {
  title?: string;
  message?: string;
  options: ActionSheetOption[];
  cancelLabel?: string;
  /** Trigger haptic feedback on show (iOS only) */
  hapticFeedback?: boolean;
  /** Reference element for iPad popover positioning */
  anchor?: number;
}

export function useIOSActionSheet() {
  const { showActionSheetWithOptions } = useActionSheet();

  const showActionSheet = ({
    title,
    message,
    options,
    cancelLabel = 'Cancel',
    hapticFeedback = true,
    anchor,
  }: UseIOSActionSheetOptions) => {
    // Add cancel option
    const allOptions = [...options, { label: cancelLabel, onPress: () => {} }];
    const optionLabels = allOptions.map(opt => opt.label);
    
    // Find destructive button indices
    const destructiveButtonIndices = options
      .map((opt, index) => opt.destructive ? index : -1)
      .filter(index => index !== -1);
    
    // Find disabled button indices
    const disabledButtonIndices = options
      .map((opt, index) => opt.disabled ? index : -1)
      .filter(index => index !== -1);
    
    const cancelButtonIndex = allOptions.length - 1;

    // Trigger haptic feedback on iOS only
    if (hapticFeedback && isIOS) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const sheetOptions: ActionSheetOptions = {
      options: optionLabels,
      cancelButtonIndex,
      destructiveButtonIndex: destructiveButtonIndices.length === 1 
        ? destructiveButtonIndices[0] 
        : destructiveButtonIndices.length > 1 
          ? destructiveButtonIndices 
          : undefined,
      disabledButtonIndices: disabledButtonIndices.length > 0 ? disabledButtonIndices : undefined,
      title,
      message,
      // iOS-specific
      userInterfaceStyle: undefined, // Follow system
    };

    // Add anchor for iPad
    if (anchor !== undefined) {
      sheetOptions.anchor = anchor;
    }

    showActionSheetWithOptions(sheetOptions, (selectedIndex) => {
      if (selectedIndex !== undefined && selectedIndex !== cancelButtonIndex) {
        const option = options[selectedIndex];
        if (option && !option.disabled) {
          // Haptic feedback on selection
          if (hapticFeedback && Platform.OS === 'ios') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          option.onPress();
        }
      }
    });
  };

  return { showActionSheet };
}

// Convenience hook for common action sheet patterns
export function useConfirmActionSheet() {
  const { showActionSheet } = useIOSActionSheet();

  const showConfirm = ({
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    destructive = false,
  }: {
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    destructive?: boolean;
  }) => {
    showActionSheet({
      title,
      message,
      options: [
        {
          label: confirmLabel,
          onPress: onConfirm,
          destructive,
        },
      ],
      cancelLabel,
    });
  };

  const showDelete = ({
    title = 'Delete',
    message,
    itemName,
    onDelete,
  }: {
    title?: string;
    message?: string;
    itemName?: string;
    onDelete: () => void;
  }) => {
    showActionSheet({
      title,
      message: message || (itemName ? `Are you sure you want to delete "${itemName}"?` : 'Are you sure you want to delete this?'),
      options: [
        {
          label: 'Delete',
          onPress: onDelete,
          destructive: true,
        },
      ],
      cancelLabel: 'Cancel',
    });
  };

  return { showConfirm, showDelete };
}
