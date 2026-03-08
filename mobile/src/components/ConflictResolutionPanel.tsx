import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useOfflineStore } from '../lib/offline-storage';
import offlineStorage, { ConflictRecord } from '../lib/offline-storage';
import { useTheme } from '../lib/theme';

interface ConflictItemProps {
  conflict: ConflictRecord;
  onResolve: (resolution: 'kept_server' | 'kept_local') => void;
}

function ConflictItem({ conflict, onResolve }: ConflictItemProps) {
  const [expanded, setExpanded] = useState(false);
  const { colors } = useTheme();
  
  const localData = JSON.parse(conflict.localData);
  const serverData = JSON.parse(conflict.serverData);
  
  const getEntityLabel = (type: string) => {
    const labels: Record<string, string> = {
      job: 'Job',
      client: 'Client',
      quote: 'Quote',
      invoice: 'Invoice',
      timeEntry: 'Time Entry',
    };
    return labels[type] || type;
  };
  
  const getEntityTitle = () => {
    const data = localData;
    if (data.name) return data.name;
    if (data.title) return data.title;
    if (data.quoteNumber) return `Quote #${data.quoteNumber}`;
    if (data.invoiceNumber) return `Invoice #${data.invoiceNumber}`;
    if (data.description) return data.description;
    return conflict.entityId.slice(0, 8);
  };
  
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  return (
    <View style={[styles.conflictItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity 
        style={styles.conflictHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.conflictInfo}>
          <View style={[styles.conflictBadge, { backgroundColor: colors.destructiveLight }]}>
            <Text style={[styles.conflictBadgeText, { color: colors.destructive }]}>{getEntityLabel(conflict.entityType)}</Text>
          </View>
          <Text style={[styles.conflictTitle, { color: colors.foreground }]} numberOfLines={1}>{getEntityTitle()}</Text>
        </View>
        <Ionicons 
          name={expanded ? 'chevron-up' : 'chevron-down'} 
          size={20} 
          color={colors.mutedForeground} 
        />
      </TouchableOpacity>
      
      {expanded && (
        <View style={[styles.conflictDetails, { borderTopColor: colors.border }]}>
          <Text style={[styles.conflictTime, { color: colors.mutedForeground }]}>
            Conflict detected: {formatTime(conflict.conflictedAt)}
          </Text>
          
          <View style={styles.dataComparison}>
            <View style={styles.dataColumn}>
              <Text style={[styles.dataLabel, { color: colors.secondaryText }]}>Your Changes</Text>
              <ScrollView style={[styles.dataContent, { backgroundColor: colors.muted }]} nestedScrollEnabled>
                <Text style={[styles.dataText, { color: colors.secondaryText }]}>
                  {JSON.stringify(localData, null, 2).slice(0, 500)}
                </Text>
              </ScrollView>
            </View>
            <View style={styles.dataColumn}>
              <Text style={[styles.dataLabel, { color: colors.secondaryText }]}>Server Version</Text>
              <ScrollView style={[styles.dataContent, { backgroundColor: colors.muted }]} nestedScrollEnabled>
                <Text style={[styles.dataText, { color: colors.secondaryText }]}>
                  {JSON.stringify(serverData, null, 2).slice(0, 500)}
                </Text>
              </ScrollView>
            </View>
          </View>
          
          <View style={styles.resolutionButtons}>
            <TouchableOpacity 
              style={[styles.resolutionButton, { backgroundColor: colors.primary + '15' }]}
              onPress={() => onResolve('kept_server')}
            >
              <Ionicons name="cloud-outline" size={16} color={colors.primary} />
              <Text style={[styles.resolutionButtonText, { color: colors.primary }]}>Use Server</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.resolutionButton, { backgroundColor: colors.warning + '15' }]}
              onPress={() => onResolve('kept_local')}
            >
              <Ionicons name="phone-portrait-outline" size={16} color={colors.warning} />
              <Text style={[styles.resolutionButtonText, { color: colors.warning }]}>Keep Mine</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

export function ConflictResolutionPanel() {
  const { unresolvedConflictCount, isOnline } = useOfflineStore();
  const { colors } = useTheme();
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (visible) {
      loadConflicts();
    }
  }, [visible]);
  
  const loadConflicts = async () => {
    setLoading(true);
    try {
      const unresolvedConflicts = await offlineStorage.getConflicts(false);
      setConflicts(unresolvedConflicts);
    } catch (error) {
      if (__DEV__) console.error('Failed to load conflicts:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleResolve = async (conflictId: string, resolution: 'kept_server' | 'kept_local') => {
    try {
      await offlineStorage.resolveConflict(conflictId, resolution);
      setConflicts(prev => prev.filter(c => c.id !== conflictId));
      
      if (resolution === 'kept_local' && isOnline) {
        await offlineStorage.syncPendingChanges();
      }
    } catch (error) {
      if (__DEV__) console.error('Failed to resolve conflict:', error);
    }
  };
  
  if (unresolvedConflictCount === 0) {
    return null;
  }
  
  return (
    <>
      <TouchableOpacity 
        style={[styles.conflictBanner, { backgroundColor: colors.destructiveLight, borderBottomColor: colors.destructive + '30' }]}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
        data-testid="banner-sync-conflicts"
      >
        <Ionicons name="alert-circle" size={18} color={colors.destructive} />
        <Text style={[styles.conflictBannerText, { color: colors.destructive }]}>
          {unresolvedConflictCount} sync conflict{unresolvedConflictCount !== 1 ? 's' : ''} need attention
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.destructive} />
      </TouchableOpacity>
      
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Sync Conflicts</Text>
            <TouchableOpacity 
              onPress={() => setVisible(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              data-testid="button-close-conflicts"
            >
              <Ionicons name="close" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          
          <Text style={[styles.modalDescription, { color: colors.secondaryText }]}>
            These items were changed on both your device and the server. Choose which version to keep.
          </Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: colors.secondaryText }]}>Loading conflicts...</Text>
            </View>
          ) : conflicts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle" size={48} color={colors.success} />
              <Text style={[styles.emptyText, { color: colors.success }]}>All conflicts resolved!</Text>
            </View>
          ) : (
            <ScrollView style={styles.conflictList}>
              {conflicts.map(conflict => (
                <ConflictItem 
                  key={conflict.id}
                  conflict={conflict}
                  onResolve={(resolution) => handleResolve(conflict.id, resolution)}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  conflictBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  conflictBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalDescription: {
    padding: 16,
    fontSize: 14,
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  conflictList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  conflictItem: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  conflictHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  conflictInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  conflictBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  conflictBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  conflictTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  conflictDetails: {
    borderTopWidth: 1,
    padding: 16,
    gap: 12,
  },
  conflictTime: {
    fontSize: 12,
  },
  dataComparison: {
    flexDirection: 'row',
    gap: 12,
  },
  dataColumn: {
    flex: 1,
    gap: 6,
  },
  dataLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  dataContent: {
    borderRadius: 8,
    padding: 10,
    maxHeight: 120,
  },
  dataText: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  resolutionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  resolutionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  resolutionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
