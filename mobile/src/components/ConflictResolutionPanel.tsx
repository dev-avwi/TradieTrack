import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useOfflineStore } from '../lib/offline-storage';
import offlineStorage, { ConflictRecord } from '../lib/offline-storage';

interface ConflictItemProps {
  conflict: ConflictRecord;
  onResolve: (resolution: 'kept_server' | 'kept_local') => void;
}

function ConflictItem({ conflict, onResolve }: ConflictItemProps) {
  const [expanded, setExpanded] = useState(false);
  
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
    <View style={styles.conflictItem}>
      <TouchableOpacity 
        style={styles.conflictHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.conflictInfo}>
          <View style={styles.conflictBadge}>
            <Text style={styles.conflictBadgeText}>{getEntityLabel(conflict.entityType)}</Text>
          </View>
          <Text style={styles.conflictTitle} numberOfLines={1}>{getEntityTitle()}</Text>
        </View>
        <Ionicons 
          name={expanded ? 'chevron-up' : 'chevron-down'} 
          size={20} 
          color="#6b7280" 
        />
      </TouchableOpacity>
      
      {expanded && (
        <View style={styles.conflictDetails}>
          <Text style={styles.conflictTime}>
            Conflict detected: {formatTime(conflict.conflictedAt)}
          </Text>
          
          <View style={styles.dataComparison}>
            <View style={styles.dataColumn}>
              <Text style={styles.dataLabel}>Your Changes</Text>
              <ScrollView style={styles.dataContent} nestedScrollEnabled>
                <Text style={styles.dataText}>
                  {JSON.stringify(localData, null, 2).slice(0, 500)}
                </Text>
              </ScrollView>
            </View>
            <View style={styles.dataColumn}>
              <Text style={styles.dataLabel}>Server Version</Text>
              <ScrollView style={styles.dataContent} nestedScrollEnabled>
                <Text style={styles.dataText}>
                  {JSON.stringify(serverData, null, 2).slice(0, 500)}
                </Text>
              </ScrollView>
            </View>
          </View>
          
          <View style={styles.resolutionButtons}>
            <TouchableOpacity 
              style={[styles.resolutionButton, styles.serverButton]}
              onPress={() => onResolve('kept_server')}
            >
              <Ionicons name="cloud-outline" size={16} color="#3b82f6" />
              <Text style={styles.serverButtonText}>Use Server</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.resolutionButton, styles.localButton]}
              onPress={() => onResolve('kept_local')}
            >
              <Ionicons name="phone-portrait-outline" size={16} color="#f59e0b" />
              <Text style={styles.localButtonText}>Keep Mine</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

export function ConflictResolutionPanel() {
  const { unresolvedConflictCount, isOnline } = useOfflineStore();
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
      console.error('Failed to load conflicts:', error);
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
      console.error('Failed to resolve conflict:', error);
    }
  };
  
  if (unresolvedConflictCount === 0) {
    return null;
  }
  
  return (
    <>
      <TouchableOpacity 
        style={styles.conflictBanner}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
        data-testid="banner-sync-conflicts"
      >
        <Ionicons name="alert-circle" size={18} color="#dc2626" />
        <Text style={styles.conflictBannerText}>
          {unresolvedConflictCount} sync conflict{unresolvedConflictCount !== 1 ? 's' : ''} need attention
        </Text>
        <Ionicons name="chevron-forward" size={18} color="#dc2626" />
      </TouchableOpacity>
      
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Sync Conflicts</Text>
            <TouchableOpacity 
              onPress={() => setVisible(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              data-testid="button-close-conflicts"
            >
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.modalDescription}>
            These items were changed on both your device and the server. Choose which version to keep.
          </Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading conflicts...</Text>
            </View>
          ) : conflicts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle" size={48} color="#10b981" />
              <Text style={styles.emptyText}>All conflicts resolved!</Text>
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
    backgroundColor: '#fef2f2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
  },
  conflictBannerText: {
    flex: 1,
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalDescription: {
    padding: 16,
    color: '#6b7280',
    fontSize: 14,
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '500',
  },
  conflictList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  conflictItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  conflictBadgeText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '500',
  },
  conflictTitle: {
    flex: 1,
    color: '#111827',
    fontSize: 15,
    fontWeight: '500',
  },
  conflictDetails: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 16,
    gap: 12,
  },
  conflictTime: {
    color: '#9ca3af',
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
    color: '#374151',
    fontSize: 12,
    fontWeight: '600',
  },
  dataContent: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 10,
    maxHeight: 120,
  },
  dataText: {
    color: '#4b5563',
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
  serverButton: {
    backgroundColor: '#eff6ff',
  },
  serverButtonText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '500',
  },
  localButton: {
    backgroundColor: '#fffbeb',
  },
  localButtonText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '500',
  },
});
