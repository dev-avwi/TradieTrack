import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { format } from 'date-fns';

interface ComplianceDocument {
  id: string;
  type: string;
  documentName: string;
  status: 'valid' | 'expired' | 'pending' | 'expiring_soon';
  expiryDate: string | null;
  issuedDate: string | null;
  documentNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  valid: {
    label: 'Valid',
    color: '#22c55e',
    bgColor: 'rgba(34,197,94,0.12)',
  },
  expiring_soon: {
    label: 'Expiring Soon',
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.12)',
  },
  expired: {
    label: 'Expired',
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.12)',
  },
  pending: {
    label: 'Pending',
    color: '#6b7280',
    bgColor: 'rgba(107,114,128,0.12)',
  },
};

const TYPE_CONFIG: Record<string, { icon: keyof typeof Feather.glyphMap; label: string; color: string }> = {
  license: { icon: 'shield', label: 'License', color: '#3b82f6' },
  insurance: { icon: 'file-text', label: 'Insurance', color: '#8b5cf6' },
  certificate: { icon: 'award', label: 'Certificate', color: '#f59e0b' },
};

const getTypeConfig = (type: string) => {
  return TYPE_CONFIG[type.toLowerCase()] || { icon: 'file' as keyof typeof Feather.glyphMap, label: type, color: '#6b7280' };
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingTop: 8,
  },
  headerLeft: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  pageSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  documentCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  documentCardExpanded: {
    borderColor: colors.primary,
  },
  documentTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  documentIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.muted,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  expiryText: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  detailsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.foreground,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(107,114,128,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  errorText: {
    fontSize: 14,
    color: colors.destructive,
    textAlign: 'center',
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
});

export default function ComplianceScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get<ComplianceDocument[]>('/api/compliance-documents');
      if (response.error) {
        setError(response.error);
      } else {
        setDocuments(response.data || []);
      }
    } catch (err) {
      setError('Failed to load compliance documents');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const validCount = documents.filter(d => d.status === 'valid').length;
  const expiringSoonCount = documents.filter(d => d.status === 'expiring_soon').length;
  const expiredCount = documents.filter(d => d.status === 'expired').length;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'dd MMM yyyy');
    } catch {
      return '—';
    }
  };

  const renderStatCards = () => (
    <View style={styles.statsRow}>
      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: STATUS_CONFIG.valid.bgColor }]}>
          <Feather name="check-circle" size={22} color={STATUS_CONFIG.valid.color} />
        </View>
        <Text style={styles.statValue}>{validCount}</Text>
        <Text style={styles.statLabel}>Valid</Text>
      </View>

      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: STATUS_CONFIG.expiring_soon.bgColor }]}>
          <Feather name="clock" size={22} color={STATUS_CONFIG.expiring_soon.color} />
        </View>
        <Text style={styles.statValue}>{expiringSoonCount}</Text>
        <Text style={styles.statLabel}>Expiring</Text>
      </View>

      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: STATUS_CONFIG.expired.bgColor }]}>
          <Feather name="alert-circle" size={22} color={STATUS_CONFIG.expired.color} />
        </View>
        <Text style={styles.statValue}>{expiredCount}</Text>
        <Text style={styles.statLabel}>Expired</Text>
      </View>
    </View>
  );

  const renderDocumentCard = (doc: ComplianceDocument) => {
    const typeConfig = getTypeConfig(doc.type);
    const statusConfig = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;
    const isExpanded = expandedId === doc.id;

    return (
      <TouchableOpacity
        key={doc.id}
        style={[styles.documentCard, isExpanded && styles.documentCardExpanded]}
        onPress={() => setExpandedId(isExpanded ? null : doc.id)}
        activeOpacity={0.7}
      >
        <View style={styles.documentTopRow}>
          <View style={[styles.documentIconContainer, { backgroundColor: `${typeConfig.color}18` }]}>
            <Feather name={typeConfig.icon} size={22} color={typeConfig.color} />
          </View>
          <View style={styles.documentInfo}>
            <Text style={styles.documentName} numberOfLines={2}>{doc.documentName}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{typeConfig.label}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
              </View>
            </View>
          </View>
          <Feather name={isExpanded ? 'chevron-up' : 'chevron-right'} size={18} color={colors.mutedForeground} />
        </View>

        {doc.expiryDate && (
          <View style={styles.expiryRow}>
            <Feather name="calendar" size={12} color={colors.mutedForeground} />
            <Text style={styles.expiryText}>Expires {formatDate(doc.expiryDate)}</Text>
          </View>
        )}

        {isExpanded && (
          <View style={styles.detailsContainer}>
            {doc.documentNumber && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Document Number</Text>
                <Text style={styles.detailValue}>{doc.documentNumber}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Issued Date</Text>
              <Text style={styles.detailValue}>{formatDate(doc.issuedDate)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Expiry Date</Text>
              <Text style={styles.detailValue}>{formatDate(doc.expiryDate)}</Text>
            </View>
            {doc.notes && (
              <View style={[styles.detailRow, { flexDirection: 'column', alignItems: 'flex-start', gap: 4 }]}>
                <Text style={styles.detailLabel}>Notes</Text>
                <Text style={[styles.detailValue, { fontWeight: '400' }]}>{doc.notes}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Feather name="shield" size={32} color="#6b7280" />
      </View>
      <Text style={styles.emptyTitle}>No Documents</Text>
      <Text style={styles.emptySubtitle}>Compliance documents like licenses, insurance and certificates will appear here.</Text>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <Feather name="alert-circle" size={40} color={colors.destructive} />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {isLoading && documents.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading compliance documents...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
          >
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.pageTitle}>Compliance</Text>
                <Text style={styles.pageSubtitle}>Licenses, insurance & certifications</Text>
              </View>
            </View>

            {error ? renderErrorState() : documents.length === 0 ? renderEmptyState() : (
              <>
                {renderStatCards()}
                {documents.map(renderDocumentCard)}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </>
  );
}
