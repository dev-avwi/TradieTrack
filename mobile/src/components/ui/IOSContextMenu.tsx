/**
 * Native iOS Context Menu Component
 * Uses zeego for native iOS context menus with haptic feedback
 * 
 * zeego provides cross-platform support:
 * - Native UIContextMenu/UIMenu on iOS with SF Symbols
 * - Cross-platform JS implementation on Android (unchanged behavior)
 * 
 * The library handles platform differences internally while providing
 * consistent API and haptic feedback on iOS.
 */
import { ReactNode } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import * as DropdownMenu from 'zeego/dropdown-menu';
import * as ContextMenu from 'zeego/context-menu';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { isIOS } from '../../lib/device';

interface MenuAction {
  key: string;
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

interface MenuGroup {
  key: string;
  actions: MenuAction[];
}

interface IOSContextMenuProps {
  children: ReactNode;
  actions: (MenuAction | MenuGroup)[];
  title?: string;
  /** Use dropdown instead of context menu (shows on tap instead of long-press) */
  asDropdown?: boolean;
  /** Haptic feedback on iOS */
  hapticFeedback?: boolean;
}

// Helper to check if item is a group
function isMenuGroup(item: MenuAction | MenuGroup): item is MenuGroup {
  return 'actions' in item;
}

export function IOSContextMenu({
  children,
  actions,
  title,
  asDropdown = false,
  hapticFeedback = true,
}: IOSContextMenuProps) {
  const { colors, isDark } = useTheme();

  const handleAction = (action: MenuAction) => {
    if (hapticFeedback && isIOS) {
      Haptics.impactAsync(
        action.destructive 
          ? Haptics.ImpactFeedbackStyle.Heavy 
          : Haptics.ImpactFeedbackStyle.Medium
      );
    }
    action.onPress();
  };

  // Render menu items
  const renderItems = () => {
    return actions.map((item, index) => {
      if (isMenuGroup(item)) {
        return (
          <DropdownMenu.Group key={item.key}>
            {item.actions.map(action => renderAction(action))}
          </DropdownMenu.Group>
        );
      }
      return renderAction(item);
    });
  };

  const renderAction = (action: MenuAction) => {
    const Menu = asDropdown ? DropdownMenu : ContextMenu;
    
    return (
      <Menu.Item
        key={action.key}
        onSelect={() => handleAction(action)}
        disabled={action.disabled}
        destructive={action.destructive}
      >
        <Menu.ItemTitle>{action.label}</Menu.ItemTitle>
        {action.icon && (
          <Menu.ItemIcon
            ios={{
              name: getIOSSystemIcon(action.icon),
              pointSize: 18,
            }}
          />
        )}
      </Menu.Item>
    );
  };

  if (asDropdown) {
    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <>{children}</>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          {title && (
            <DropdownMenu.Label>{title}</DropdownMenu.Label>
          )}
          {actions.map((item, index) => {
            if (isMenuGroup(item)) {
              return (
                <DropdownMenu.Group key={item.key}>
                  {item.actions.map(action => (
                    <DropdownMenu.Item
                      key={action.key}
                      onSelect={() => handleAction(action)}
                      disabled={action.disabled}
                      destructive={action.destructive}
                    >
                      <DropdownMenu.ItemTitle>{action.label}</DropdownMenu.ItemTitle>
                      {action.icon && (
                        <DropdownMenu.ItemIcon
                          ios={{
                            name: getIOSSystemIcon(action.icon),
                            pointSize: 18,
                          }}
                        />
                      )}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Group>
              );
            }
            return (
              <DropdownMenu.Item
                key={item.key}
                onSelect={() => handleAction(item)}
                disabled={item.disabled}
                destructive={item.destructive}
              >
                <DropdownMenu.ItemTitle>{item.label}</DropdownMenu.ItemTitle>
                {item.icon && (
                  <DropdownMenu.ItemIcon
                    ios={{
                      name: getIOSSystemIcon(item.icon),
                      pointSize: 18,
                    }}
                  />
                )}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    );
  }

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger>
        <>{children}</>
      </ContextMenu.Trigger>
      <ContextMenu.Content>
        {title && (
          <ContextMenu.Label>{title}</ContextMenu.Label>
        )}
        {actions.map((item, index) => {
          if (isMenuGroup(item)) {
            return (
              <ContextMenu.Group key={item.key}>
                {item.actions.map(action => (
                  <ContextMenu.Item
                    key={action.key}
                    onSelect={() => handleAction(action)}
                    disabled={action.disabled}
                    destructive={action.destructive}
                  >
                    <ContextMenu.ItemTitle>{action.label}</ContextMenu.ItemTitle>
                    {action.icon && (
                      <ContextMenu.ItemIcon
                        ios={{
                          name: getIOSSystemIcon(action.icon),
                          pointSize: 18,
                        }}
                      />
                    )}
                  </ContextMenu.Item>
                ))}
              </ContextMenu.Group>
            );
          }
          return (
            <ContextMenu.Item
              key={item.key}
              onSelect={() => handleAction(item)}
              disabled={item.disabled}
              destructive={item.destructive}
            >
              <ContextMenu.ItemTitle>{item.label}</ContextMenu.ItemTitle>
              {item.icon && (
                <ContextMenu.ItemIcon
                  ios={{
                    name: getIOSSystemIcon(item.icon),
                    pointSize: 18,
                  }}
                />
              )}
            </ContextMenu.Item>
          );
        })}
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
}

// Map Feather icons to iOS SF Symbols
function getIOSSystemIcon(featherIcon: keyof typeof Feather.glyphMap): string {
  const iconMap: Record<string, string> = {
    // Common actions
    'edit': 'pencil',
    'edit-2': 'pencil',
    'edit-3': 'pencil',
    'trash': 'trash',
    'trash-2': 'trash',
    'delete': 'trash',
    'copy': 'doc.on.doc',
    'share': 'square.and.arrow.up',
    'share-2': 'square.and.arrow.up',
    'download': 'arrow.down.circle',
    'upload': 'arrow.up.circle',
    'plus': 'plus',
    'minus': 'minus',
    'check': 'checkmark',
    'x': 'xmark',
    'close': 'xmark',
    
    // Navigation
    'arrow-left': 'arrow.left',
    'arrow-right': 'arrow.right',
    'arrow-up': 'arrow.up',
    'arrow-down': 'arrow.down',
    'chevron-left': 'chevron.left',
    'chevron-right': 'chevron.right',
    'chevron-up': 'chevron.up',
    'chevron-down': 'chevron.down',
    
    // Status
    'alert-circle': 'exclamationmark.circle',
    'alert-triangle': 'exclamationmark.triangle',
    'info': 'info.circle',
    'help-circle': 'questionmark.circle',
    
    // Media
    'image': 'photo',
    'camera': 'camera',
    'video': 'video',
    'mic': 'mic',
    'volume-2': 'speaker.wave.2',
    
    // Communication
    'mail': 'envelope',
    'message-circle': 'bubble.left',
    'message-square': 'bubble.left',
    'phone': 'phone',
    'send': 'paperplane',
    
    // Objects
    'file': 'doc',
    'file-text': 'doc.text',
    'folder': 'folder',
    'calendar': 'calendar',
    'clock': 'clock',
    'map-pin': 'mappin',
    'map': 'map',
    'settings': 'gear',
    'sliders': 'slider.horizontal.3',
    'user': 'person',
    'users': 'person.2',
    'heart': 'heart',
    'star': 'star',
    'bookmark': 'bookmark',
    'tag': 'tag',
    'link': 'link',
    'external-link': 'arrow.up.forward',
    'eye': 'eye',
    'eye-off': 'eye.slash',
    'lock': 'lock',
    'unlock': 'lock.open',
    'key': 'key',
    'search': 'magnifyingglass',
    'filter': 'line.3.horizontal.decrease',
    'refresh-cw': 'arrow.clockwise',
    'repeat': 'repeat',
    'shuffle': 'shuffle',
    
    // Business
    'briefcase': 'briefcase',
    'dollar-sign': 'dollarsign.circle',
    'credit-card': 'creditcard',
    'shopping-cart': 'cart',
    'truck': 'shippingbox',
    'tool': 'wrench',
    'clipboard': 'doc.on.clipboard',
    'printer': 'printer',
    
    // Layout
    'grid': 'square.grid.2x2',
    'list': 'list.bullet',
    'menu': 'line.3.horizontal',
    'more-horizontal': 'ellipsis',
    'more-vertical': 'ellipsis',
  };

  return iconMap[featherIcon] || 'circle';
}

export default IOSContextMenu;
