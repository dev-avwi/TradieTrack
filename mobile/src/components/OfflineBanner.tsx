import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export function OfflineBanner() {
  const { isOffline, pendingChanges, syncNow, isConnected } = useNetworkStatus();
  const slideAnim = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOffline || pendingChanges > 0 ? 0 : -60,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOffline, pendingChanges]);

  if (!isOffline && pendingChanges === 0) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          backgroundColor: isOffline ? '#ef4444' : '#f59e0b',
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.text}>
          {isOffline
            ? 'You are offline. Changes will sync when connected.'
            : `${pendingChanges} change${pendingChanges !== 1 ? 's' : ''} pending sync`}
        </Text>
        {!isOffline && pendingChanges > 0 && (
          <TouchableOpacity onPress={syncNow} style={styles.syncButton}>
            <Text style={styles.syncButtonText}>Sync Now</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 44,
    paddingBottom: 8,
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  text: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  syncButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 12,
  },
  syncButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default OfflineBanner;
