import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator, Modal, TextInput, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { spacing, radius, shadows, typography, pageShell, componentStyles } from '../../src/lib/design-tokens';

type TabKey = 'incidents' | 'emergency' | 'jsa' | 'environments' | 'signage';

const TABS: { key: TabKey; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'incidents', label: 'Incidents', icon: 'alert-triangle' },
  { key: 'emergency', label: 'Emergency', icon: 'phone' },
  { key: 'jsa', label: 'JSA', icon: 'clipboard' },
  { key: 'environments', label: 'Hazards', icon: 'zap' },
  { key: 'signage', label: 'Signs', icon: 'eye' },
];

const INCIDENT_TYPES = [
  { value: 'near_miss', label: 'Near Miss' },
  { value: 'injury', label: 'Injury' },
  { value: 'property_damage', label: 'Property Damage' },
  { value: 'environmental', label: 'Environmental' },
  { value: 'dangerous_occurrence', label: 'Dangerous Occurrence' },
  { value: 'notifiable_incident', label: 'Notifiable Incident' },
];

const SEVERITIES = [
  { value: 'minor', label: 'Minor', color: '#f59e0b' },
  { value: 'moderate', label: 'Moderate', color: '#f97316' },
  { value: 'serious', label: 'Serious', color: '#ef4444' },
  { value: 'critical', label: 'Critical', color: '#dc2626' },
];

const REPORTED_TO_ROLES = [
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'leading_hand', label: 'Leading Hand' },
  { value: 'foreman', label: 'Foreman' },
  { value: 'hse_advisor', label: 'HSE Advisor' },
  { value: 'hsr', label: 'HSR' },
];

export default function WhsHubScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('incidents');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [incidents, setIncidents] = useState<any[]>([]);
  const [emergencyInfo, setEmergencyInfo] = useState<any[]>([]);
  const [jsaDocs, setJsaDocs] = useState<any[]>([]);
  const [environments, setEnvironments] = useState<any[]>([]);
  const [signs, setSigns] = useState<any[]>([]);
  const [envTypes, setEnvTypes] = useState<any[]>([]);
  const [signTypes, setSignTypes] = useState<any[]>([]);

  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [showEmergencyForm, setShowEmergencyForm] = useState(false);
  const [showJsaForm, setShowJsaForm] = useState(false);
  const [showEnvForm, setShowEnvForm] = useState(false);
  const [showSignForm, setShowSignForm] = useState(false);

  const [incidentForm, setIncidentForm] = useState({
    title: '', description: '', incidentType: 'near_miss', severity: 'minor',
    location: '', reportedTo: '', reportedToRole: 'supervisor', workerName: '',
    immediateActions: '', isNotifiable: false,
  });

  const [emergencyForm, setEmergencyForm] = useState({
    siteName: '', siteAddress: '', assemblyPoint: '', firstAidLocation: '',
    firstAidOfficer: '', firstAidOfficerPhone: '', emergencyNumber: '000',
    nearestHospital: '',
  });

  const [jsaForm, setJsaForm] = useState({
    title: '', description: '', siteAddress: '', assessedBy: '',
    steps: [{ taskDescription: '', hazards: '', riskLevel: 'medium', controlMeasures: '', responsiblePerson: '' }],
  });

  const [selectedEnvType, setSelectedEnvType] = useState('');
  const [signForm, setSignForm] = useState({ signType: '', signCategory: '', location: '' });

  const fetchData = useCallback(async () => {
    try {
      const [incRes, emRes, jsaRes, envRes, signRes, envTypesRes, signTypesRes] = await Promise.all([
        api.get('/api/whs/incidents'),
        api.get('/api/whs/emergency-info'),
        api.get('/api/whs/jsa'),
        api.get('/api/whs/hazardous-environments'),
        api.get('/api/whs/safety-signage'),
        api.get('/api/whs/reference/environment-types'),
        api.get('/api/whs/reference/sign-types'),
      ]);
      setIncidents(Array.isArray(incRes.data) ? incRes.data : []);
      setEmergencyInfo(Array.isArray(emRes.data) ? emRes.data : []);
      setJsaDocs(Array.isArray(jsaRes.data) ? jsaRes.data : []);
      setEnvironments(Array.isArray(envRes.data) ? envRes.data : []);
      setSigns(Array.isArray(signRes.data) ? signRes.data : []);
      setEnvTypes(Array.isArray(envTypesRes.data) ? envTypesRes.data : []);
      setSignTypes(Array.isArray(signTypesRes.data) ? signTypesRes.data : []);
    } catch (e) {
      console.error('Failed to fetch WHS data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);

  async function submitIncident() {
    if (!incidentForm.title || !incidentForm.description) {
      Alert.alert('Required', 'Title and description are required');
      return;
    }
    try {
      await api.post('/api/whs/incidents', incidentForm);
      setShowIncidentForm(false);
      setIncidentForm({ title: '', description: '', incidentType: 'near_miss', severity: 'minor', location: '', reportedTo: '', reportedToRole: 'supervisor', workerName: '', immediateActions: '', isNotifiable: false });
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to submit');
    }
  }

  async function submitEmergency() {
    if (!emergencyForm.siteName) {
      Alert.alert('Required', 'Site name is required');
      return;
    }
    try {
      await api.post('/api/whs/emergency-info', emergencyForm);
      setShowEmergencyForm(false);
      setEmergencyForm({ siteName: '', siteAddress: '', assemblyPoint: '', firstAidLocation: '', firstAidOfficer: '', firstAidOfficerPhone: '', emergencyNumber: '000', nearestHospital: '' });
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save');
    }
  }

  async function submitJsa() {
    if (!jsaForm.title) {
      Alert.alert('Required', 'Title is required');
      return;
    }
    const validSteps = jsaForm.steps.filter(s => s.taskDescription && s.hazards && s.controlMeasures);
    if (validSteps.length === 0) {
      Alert.alert('Required', 'At least one complete step is required');
      return;
    }
    try {
      await api.post('/api/whs/jsa', { ...jsaForm, steps: validSteps });
      setShowJsaForm(false);
      setJsaForm({ title: '', description: '', siteAddress: '', assessedBy: '', steps: [{ taskDescription: '', hazards: '', riskLevel: 'medium', controlMeasures: '', responsiblePerson: '' }] });
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create');
    }
  }

  async function addEnvironment() {
    const envType = envTypes.find((t: any) => t.type === selectedEnvType);
    if (!envType) return;
    try {
      await api.post('/api/whs/hazardous-environments', {
        environmentType: envType.type,
        hazards: envType.defaultHazards,
        controlMeasures: [],
        requiredPpe: envType.defaultPpe,
        requiredLicenses: envType.requiredLicenses,
      });
      setShowEnvForm(false);
      setSelectedEnvType('');
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add');
    }
  }

  async function addSign() {
    if (!signForm.signType || !signForm.signCategory) {
      Alert.alert('Required', 'Select a sign type');
      return;
    }
    try {
      await api.post('/api/whs/safety-signage', signForm);
      setShowSignForm(false);
      setSignForm({ signType: '', signCategory: '', location: '' });
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add');
    }
  }

  async function toggleSignInstalled(sign: any) {
    try {
      await api.patch(`/api/whs/safety-signage/${sign.id}`, { isInstalled: !sign.isInstalled });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  }

  async function deleteItem(endpoint: string, id: string) {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`${endpoint}/${id}`);
          fetchData();
        } catch (e) { console.error(e); }
      }},
    ]);
  }

  async function closeIncident(id: string) {
    try {
      await api.patch(`/api/whs/incidents/${id}`, { status: 'closed' });
      fetchData();
    } catch (e) { console.error(e); }
  }

  const openIncidents = incidents.filter(r => r.status === 'open').length;

  const styles = StyleSheet.create({
    container: { ...pageShell, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md },
    statsRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.md },
    statCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', ...shadows.sm },
    statNumber: { fontSize: 24, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
    statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    tabsRow: { flexDirection: 'row', paddingHorizontal: spacing.md, marginBottom: spacing.md, gap: spacing.xs },
    tab: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.card },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 12, color: colors.textSecondary },
    tabTextActive: { color: '#fff' },
    card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadows.sm },
    cardTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
    cardSubtext: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, marginRight: spacing.xs, marginBottom: spacing.xs },
    badgeText: { fontSize: 11, fontWeight: '600' },
    fab: { position: 'absolute', bottom: spacing.xl, right: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.lg },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
    emptyText: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' },
    modalContainer: { flex: 1, backgroundColor: colors.background },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    modalBody: { padding: spacing.md },
    inputLabel: { fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: spacing.xs },
    input: { backgroundColor: colors.inputBackground || colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, fontSize: 15, color: colors.text, marginBottom: spacing.md },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    submitBtn: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
    optionChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    optionChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    optionChipText: { fontSize: 12, color: colors.text },
    optionChipTextActive: { color: '#fff' },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    stepCard: { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm },
    stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
    hazardBadge: { backgroundColor: 'rgba(239,68,68,0.12)', paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: radius.sm, marginRight: 4, marginBottom: 4 },
    hazardBadgeText: { fontSize: 10, color: '#ef4444', fontWeight: '600' },
    ppeBadge: { backgroundColor: 'rgba(59,130,246,0.12)', paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: radius.sm, marginRight: 4, marginBottom: 4 },
    ppeBadgeText: { fontSize: 10, color: '#3b82f6', fontWeight: '600' },
    checkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm, marginTop: spacing.sm },
  });

  function renderIncidents() {
    if (incidents.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Feather name="alert-triangle" size={40} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No incident reports yet.{'\n'}Report incidents to keep your site safe.</Text>
        </View>
      );
    }
    return incidents.map(report => {
      const severity = SEVERITIES.find(s => s.value === report.severity);
      return (
        <View key={report.id} style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{report.title}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                <View style={[styles.badge, { backgroundColor: (severity?.color || '#f59e0b') + '20' }]}>
                  <Text style={[styles.badgeText, { color: severity?.color || '#f59e0b' }]}>{report.severity}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: colors.border }]}>
                  <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{INCIDENT_TYPES.find(t => t.value === report.incidentType)?.label || report.incidentType}</Text>
                </View>
                {report.isNotifiable && (
                  <View style={[styles.badge, { backgroundColor: '#ef444420' }]}>
                    <Text style={[styles.badgeText, { color: '#ef4444' }]}>Notifiable</Text>
                  </View>
                )}
                <View style={[styles.badge, { backgroundColor: report.status === 'open' ? '#3b82f620' : '#22c55e20' }]}>
                  <Text style={[styles.badgeText, { color: report.status === 'open' ? '#3b82f6' : '#22c55e' }]}>{report.status}</Text>
                </View>
              </View>
              <Text numberOfLines={2} style={[styles.cardSubtext, { marginTop: 6 }]}>{report.description}</Text>
              {report.location && <Text style={styles.cardSubtext}>{report.location}</Text>}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {report.status === 'open' && (
                <TouchableOpacity onPress={() => closeIncident(report.id)}>
                  <Feather name="check-circle" size={20} color="#22c55e" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => deleteItem('/api/whs/incidents', report.id)}>
                <Feather name="trash-2" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    });
  }

  function renderEmergency() {
    if (emergencyInfo.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Feather name="phone" size={40} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No emergency plans yet.{'\n'}Set up emergency info for your sites.</Text>
        </View>
      );
    }
    return emergencyInfo.map(info => (
      <View key={info.id} style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <View style={styles.row}>
              <Feather name="home" size={16} color={colors.primary} />
              <Text style={styles.cardTitle}>{info.siteName}</Text>
            </View>
            {info.siteAddress && <Text style={styles.cardSubtext}>{info.siteAddress}</Text>}
          </View>
          <TouchableOpacity onPress={() => deleteItem('/api/whs/emergency-info', info.id)}>
            <Feather name="trash-2" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
          {info.assemblyPoint && (
            <View style={styles.row}>
              <Feather name="map-pin" size={14} color="#22c55e" />
              <Text style={{ fontSize: 13, color: colors.text }}>Assembly: {info.assemblyPoint}</Text>
            </View>
          )}
          {info.firstAidLocation && (
            <View style={styles.row}>
              <Feather name="plus-circle" size={14} color="#3b82f6" />
              <Text style={{ fontSize: 13, color: colors.text }}>First Aid: {info.firstAidLocation}</Text>
            </View>
          )}
          {info.firstAidOfficer && (
            <View style={styles.row}>
              <Feather name="user" size={14} color="#8b5cf6" />
              <Text style={{ fontSize: 13, color: colors.text }}>First Aid Officer: {info.firstAidOfficer} {info.firstAidOfficerPhone ? `(${info.firstAidOfficerPhone})` : ''}</Text>
            </View>
          )}
          {info.nearestHospital && (
            <View style={styles.row}>
              <Feather name="activity" size={14} color="#ef4444" />
              <Text style={{ fontSize: 13, color: colors.text }}>Hospital: {info.nearestHospital}</Text>
            </View>
          )}
          <View style={[styles.row, { marginTop: spacing.xs }]}>
            <View style={[styles.badge, { backgroundColor: '#ef444420' }]}>
              <Text style={[styles.badgeText, { color: '#ef4444' }]}>Emergency: {info.emergencyNumber || '000'}</Text>
            </View>
          </View>
        </View>
      </View>
    ));
  }

  function renderJsa() {
    if (jsaDocs.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Feather name="clipboard" size={40} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No JSAs created yet.{'\n'}Create a Job Safety Analysis before starting work.</Text>
        </View>
      );
    }
    return jsaDocs.map(doc => (
      <View key={doc.id} style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{doc.title}</Text>
            <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
              <View style={[styles.badge, { backgroundColor: doc.status === 'active' ? '#22c55e20' : colors.border }]}>
                <Text style={[styles.badgeText, { color: doc.status === 'active' ? '#22c55e' : colors.textSecondary }]}>{doc.status}</Text>
              </View>
            </View>
            {doc.siteAddress && <Text style={styles.cardSubtext}>{doc.siteAddress}</Text>}
            {doc.assessedBy && <Text style={styles.cardSubtext}>Assessed by: {doc.assessedBy}</Text>}
          </View>
          <TouchableOpacity onPress={() => deleteItem('/api/whs/jsa', doc.id)}>
            <Feather name="trash-2" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        {doc.steps && doc.steps.length > 0 && (
          <View style={{ marginTop: spacing.sm }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>STEPS ({doc.steps.length})</Text>
            {doc.steps.map((step: any, i: number) => {
              const riskColor = step.riskLevel === 'low' ? '#22c55e' : step.riskLevel === 'medium' ? '#f59e0b' : step.riskLevel === 'high' ? '#f97316' : '#ef4444';
              return (
                <View key={step.id || i} style={styles.stepCard}>
                  <View style={styles.stepHeader}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>Step {i + 1}: {step.taskDescription}</Text>
                    <View style={[styles.badge, { backgroundColor: riskColor + '20', marginBottom: 0 }]}>
                      <Text style={[styles.badgeText, { color: riskColor }]}>{step.riskLevel}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Hazards: {step.hazards}</Text>
                  <Text style={{ fontSize: 11, color: colors.text, marginTop: 2 }}>Controls: {step.controlMeasures}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    ));
  }

  function renderEnvironments() {
    if (environments.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Feather name="zap" size={40} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No hazardous environments tracked yet.</Text>
        </View>
      );
    }
    return environments.map(env => {
      const envType = envTypes.find((t: any) => t.type === env.environmentType);
      return (
        <View key={env.id} style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={styles.cardTitle}>{envType?.label || env.environmentType}</Text>
            <TouchableOpacity onPress={() => deleteItem('/api/whs/hazardous-environments', env.id)}>
              <Feather name="trash-2" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {env.hazards?.length > 0 && (
            <View style={{ marginTop: spacing.xs }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>HAZARDS</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
                {env.hazards.map((h: string, i: number) => (
                  <View key={i} style={styles.hazardBadge}><Text style={styles.hazardBadgeText}>{h}</Text></View>
                ))}
              </View>
            </View>
          )}
          {env.requiredPpe?.length > 0 && (
            <View style={{ marginTop: spacing.xs }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>PPE REQUIRED</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
                {env.requiredPpe.map((p: string, i: number) => (
                  <View key={i} style={styles.ppeBadge}><Text style={styles.ppeBadgeText}>{p}</Text></View>
                ))}
              </View>
            </View>
          )}
        </View>
      );
    });
  }

  function renderSignage() {
    if (signs.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Feather name="eye" size={40} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No safety signage requirements tracked yet.</Text>
        </View>
      );
    }
    const installed = signs.filter(s => s.isInstalled).length;
    return (
      <>
        <View style={[styles.badge, { backgroundColor: '#3b82f620', alignSelf: 'flex-start', marginBottom: spacing.sm }]}>
          <Text style={[styles.badgeText, { color: '#3b82f6' }]}>{installed}/{signs.length} Installed</Text>
        </View>
        {signs.map(sign => (
          <TouchableOpacity key={sign.id} onPress={() => toggleSignInstalled(sign)} style={styles.checkRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.sm }}>
              <Feather name={sign.isInstalled ? 'check-circle' : 'circle'} size={20} color={sign.isInstalled ? '#22c55e' : colors.textSecondary} />
              <View>
                <Text style={[{ fontSize: 14, color: colors.text }, sign.isInstalled && { textDecorationLine: 'line-through', color: colors.textSecondary }]}>{sign.signType}</Text>
                {sign.location && <Text style={{ fontSize: 11, color: colors.textSecondary }}>{sign.location}</Text>}
              </View>
            </View>
            <TouchableOpacity onPress={() => deleteItem('/api/whs/safety-signage', sign.id)}>
              <Feather name="trash-2" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </>
    );
  }

  function renderIncidentModal() {
    return (
      <Modal visible={showIncidentForm} animationType="slide">
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowIncidentForm(false)}>
              <Text style={{ fontSize: 16, color: colors.primary }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Report Incident</Text>
            <TouchableOpacity onPress={submitIncident}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.primary }}>Submit</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput style={styles.input} value={incidentForm.title} onChangeText={v => setIncidentForm(p => ({ ...p, title: v }))} placeholder="What happened?" placeholderTextColor={colors.textSecondary} />

            <Text style={styles.inputLabel}>Incident Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              <View style={styles.optionRow}>
                {INCIDENT_TYPES.map(t => (
                  <TouchableOpacity key={t.value} style={[styles.optionChip, incidentForm.incidentType === t.value && styles.optionChipActive]} onPress={() => setIncidentForm(p => ({ ...p, incidentType: t.value }))}>
                    <Text style={[styles.optionChipText, incidentForm.incidentType === t.value && styles.optionChipTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.inputLabel}>Severity</Text>
            <View style={[styles.optionRow, { marginBottom: spacing.md }]}>
              {SEVERITIES.map(s => (
                <TouchableOpacity key={s.value} style={[styles.optionChip, incidentForm.severity === s.value && { backgroundColor: s.color + '30', borderColor: s.color }]} onPress={() => setIncidentForm(p => ({ ...p, severity: s.value }))}>
                  <Text style={[styles.optionChipText, incidentForm.severity === s.value && { color: s.color, fontWeight: '600' }]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Description *</Text>
            <TextInput style={[styles.input, styles.textArea]} value={incidentForm.description} onChangeText={v => setIncidentForm(p => ({ ...p, description: v }))} placeholder="Detailed description..." placeholderTextColor={colors.textSecondary} multiline />

            <Text style={styles.inputLabel}>Location</Text>
            <TextInput style={styles.input} value={incidentForm.location} onChangeText={v => setIncidentForm(p => ({ ...p, location: v }))} placeholder="Where did it happen?" placeholderTextColor={colors.textSecondary} />

            <Text style={styles.inputLabel}>Reported To</Text>
            <TextInput style={styles.input} value={incidentForm.reportedTo} onChangeText={v => setIncidentForm(p => ({ ...p, reportedTo: v }))} placeholder="Supervisor/HSR name" placeholderTextColor={colors.textSecondary} />

            <Text style={styles.inputLabel}>Worker Involved</Text>
            <TextInput style={styles.input} value={incidentForm.workerName} onChangeText={v => setIncidentForm(p => ({ ...p, workerName: v }))} placeholder="Name of worker" placeholderTextColor={colors.textSecondary} />

            <Text style={styles.inputLabel}>Immediate Actions Taken</Text>
            <TextInput style={[styles.input, styles.textArea]} value={incidentForm.immediateActions} onChangeText={v => setIncidentForm(p => ({ ...p, immediateActions: v }))} placeholder="What was done immediately?" placeholderTextColor={colors.textSecondary} multiline />

            <TouchableOpacity style={[styles.row, { marginBottom: spacing.xl }]} onPress={() => setIncidentForm(p => ({ ...p, isNotifiable: !p.isNotifiable }))}>
              <Feather name={incidentForm.isNotifiable ? 'check-square' : 'square'} size={20} color={incidentForm.isNotifiable ? colors.primary : colors.textSecondary} />
              <Text style={{ fontSize: 14, color: colors.text }}>This is a notifiable incident</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  function renderEmergencyModal() {
    return (
      <Modal visible={showEmergencyForm} animationType="slide">
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEmergencyForm(false)}>
              <Text style={{ fontSize: 16, color: colors.primary }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Emergency Plan</Text>
            <TouchableOpacity onPress={submitEmergency}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.primary }}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Site Name *</Text>
            <TextInput style={styles.input} value={emergencyForm.siteName} onChangeText={v => setEmergencyForm(p => ({ ...p, siteName: v }))} placeholder="e.g. 42 Smith St Build" placeholderTextColor={colors.textSecondary} />

            <Text style={styles.inputLabel}>Site Address</Text>
            <TextInput style={styles.input} value={emergencyForm.siteAddress} onChangeText={v => setEmergencyForm(p => ({ ...p, siteAddress: v }))} placeholder="Full address" placeholderTextColor={colors.textSecondary} />

            <Text style={styles.inputLabel}>Assembly Point</Text>
            <TextInput style={styles.input} value={emergencyForm.assemblyPoint} onChangeText={v => setEmergencyForm(p => ({ ...p, assemblyPoint: v }))} placeholder="e.g. Front car park" placeholderTextColor={colors.textSecondary} />

            <Text style={styles.inputLabel}>First Aid Station</Text>
            <TextInput style={styles.input} value={emergencyForm.firstAidLocation} onChangeText={v => setEmergencyForm(p => ({ ...p, firstAidLocation: v }))} placeholder="e.g. Site office" placeholderTextColor={colors.textSecondary} />

            <Text style={styles.inputLabel}>First Aid Officer</Text>
            <TextInput style={styles.input} value={emergencyForm.firstAidOfficer} onChangeText={v => setEmergencyForm(p => ({ ...p, firstAidOfficer: v }))} placeholder="Officer name" placeholderTextColor={colors.textSecondary} />

            <Text style={styles.inputLabel}>First Aid Officer Phone</Text>
            <TextInput style={styles.input} value={emergencyForm.firstAidOfficerPhone} onChangeText={v => setEmergencyForm(p => ({ ...p, firstAidOfficerPhone: v }))} placeholder="Phone number" placeholderTextColor={colors.textSecondary} keyboardType="phone-pad" />

            <Text style={styles.inputLabel}>Emergency Number</Text>
            <TextInput style={styles.input} value={emergencyForm.emergencyNumber} onChangeText={v => setEmergencyForm(p => ({ ...p, emergencyNumber: v }))} placeholderTextColor={colors.textSecondary} keyboardType="phone-pad" />

            <Text style={styles.inputLabel}>Nearest Hospital</Text>
            <TextInput style={styles.input} value={emergencyForm.nearestHospital} onChangeText={v => setEmergencyForm(p => ({ ...p, nearestHospital: v }))} placeholder="Hospital name" placeholderTextColor={colors.textSecondary} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  function renderJsaModal() {
    return (
      <Modal visible={showJsaForm} animationType="slide">
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowJsaForm(false)}>
              <Text style={{ fontSize: 16, color: colors.primary }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New JSA</Text>
            <TouchableOpacity onPress={submitJsa}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.primary }}>Create</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput style={styles.input} value={jsaForm.title} onChangeText={v => setJsaForm(p => ({ ...p, title: v }))} placeholder="e.g. Roof Repair" placeholderTextColor={colors.textSecondary} />

            <Text style={styles.inputLabel}>Site Address</Text>
            <TextInput style={styles.input} value={jsaForm.siteAddress} onChangeText={v => setJsaForm(p => ({ ...p, siteAddress: v }))} placeholder="Job site address" placeholderTextColor={colors.textSecondary} />

            <Text style={styles.inputLabel}>Assessed By</Text>
            <TextInput style={styles.input} value={jsaForm.assessedBy} onChangeText={v => setJsaForm(p => ({ ...p, assessedBy: v }))} placeholder="Your name" placeholderTextColor={colors.textSecondary} />

            <Text style={styles.sectionTitle}>Job Steps</Text>
            {jsaForm.steps.map((step, i) => (
              <View key={i} style={styles.stepCard}>
                <View style={styles.stepHeader}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Step {i + 1}</Text>
                  {jsaForm.steps.length > 1 && (
                    <TouchableOpacity onPress={() => setJsaForm(p => ({ ...p, steps: p.steps.filter((_, idx) => idx !== i) }))}>
                      <Feather name="trash-2" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput style={styles.input} value={step.taskDescription} onChangeText={v => { const s = [...jsaForm.steps]; s[i] = { ...s[i], taskDescription: v }; setJsaForm(p => ({ ...p, steps: s })); }} placeholder="Task description *" placeholderTextColor={colors.textSecondary} />
                <TextInput style={styles.input} value={step.hazards} onChangeText={v => { const s = [...jsaForm.steps]; s[i] = { ...s[i], hazards: v }; setJsaForm(p => ({ ...p, steps: s })); }} placeholder="Hazards *" placeholderTextColor={colors.textSecondary} />
                <TextInput style={[styles.input, styles.textArea]} value={step.controlMeasures} onChangeText={v => { const s = [...jsaForm.steps]; s[i] = { ...s[i], controlMeasures: v }; setJsaForm(p => ({ ...p, steps: s })); }} placeholder="Control measures *" placeholderTextColor={colors.textSecondary} multiline />
                <View style={styles.optionRow}>
                  {['low', 'medium', 'high', 'extreme'].map(level => {
                    const riskColor = level === 'low' ? '#22c55e' : level === 'medium' ? '#f59e0b' : level === 'high' ? '#f97316' : '#ef4444';
                    return (
                      <TouchableOpacity key={level} style={[styles.optionChip, step.riskLevel === level && { backgroundColor: riskColor + '30', borderColor: riskColor }]} onPress={() => { const s = [...jsaForm.steps]; s[i] = { ...s[i], riskLevel: level }; setJsaForm(p => ({ ...p, steps: s })); }}>
                        <Text style={[styles.optionChipText, step.riskLevel === level && { color: riskColor, fontWeight: '600' }]}>{level}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]} onPress={() => setJsaForm(p => ({ ...p, steps: [...p.steps, { taskDescription: '', hazards: '', riskLevel: 'medium', controlMeasures: '', responsiblePerson: '' }] }))}>
              <Text style={[styles.submitBtnText, { color: colors.text }]}>+ Add Step</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  function renderEnvModal() {
    const envType = envTypes.find((t: any) => t.type === selectedEnvType);
    return (
      <Modal visible={showEnvForm} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowEnvForm(false); setSelectedEnvType(''); }}>
              <Text style={{ fontSize: 16, color: colors.primary }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Environment</Text>
            <TouchableOpacity onPress={addEnvironment}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: selectedEnvType ? colors.primary : colors.textSecondary }}>Add</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Select Environment Type</Text>
            <View style={{ gap: spacing.xs }}>
              {envTypes.map((t: any) => (
                <TouchableOpacity key={t.type} style={[styles.card, selectedEnvType === t.type && { borderWidth: 2, borderColor: colors.primary }]} onPress={() => setSelectedEnvType(t.type)}>
                  <Text style={[styles.cardTitle, { fontSize: 14 }]}>{t.label}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
                    {t.defaultHazards.slice(0, 3).map((h: string, i: number) => (
                      <View key={i} style={styles.hazardBadge}><Text style={styles.hazardBadgeText}>{h}</Text></View>
                    ))}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            {envType && (
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.sectionTitle}>Required PPE</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {envType.defaultPpe.map((p: string, i: number) => (
                    <View key={i} style={styles.ppeBadge}><Text style={styles.ppeBadgeText}>{p}</Text></View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    );
  }

  function renderSignModal() {
    return (
      <Modal visible={showSignForm} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSignForm(false)}>
              <Text style={{ fontSize: 16, color: colors.primary }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Sign</Text>
            <TouchableOpacity onPress={addSign}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.primary }}>Add</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Category</Text>
            {signTypes.map((cat: any) => (
              <View key={cat.category} style={{ marginBottom: spacing.md }}>
                <TouchableOpacity onPress={() => setSignForm(p => ({ ...p, signCategory: cat.category, signType: '' }))}>
                  <Text style={[styles.sectionTitle, signForm.signCategory === cat.category && { color: colors.primary }]}>{cat.label}</Text>
                </TouchableOpacity>
                {signForm.signCategory === cat.category && (
                  <View style={{ gap: spacing.xs }}>
                    {cat.signs.map((s: string) => (
                      <TouchableOpacity key={s} style={[styles.checkRow, signForm.signType === s && { backgroundColor: colors.primary + '10' }]} onPress={() => setSignForm(p => ({ ...p, signType: s }))}>
                        <View style={styles.row}>
                          <Feather name={signForm.signType === s ? 'check-circle' : 'circle'} size={18} color={signForm.signType === s ? colors.primary : colors.textSecondary} />
                          <Text style={{ fontSize: 14, color: colors.text }}>{s}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}
            <Text style={styles.inputLabel}>Location</Text>
            <TextInput style={styles.input} value={signForm.location} onChangeText={v => setSignForm(p => ({ ...p, location: v }))} placeholder="Where should this sign be?" placeholderTextColor={colors.textSecondary} />
          </ScrollView>
        </View>
      </Modal>
    );
  }

  const showFab = !showIncidentForm && !showEmergencyForm && !showJsaForm && !showEnvForm && !showSignForm;
  const fabAction = () => {
    switch (activeTab) {
      case 'incidents': setShowIncidentForm(true); break;
      case 'emergency': setShowEmergencyForm(true); break;
      case 'jsa': setShowJsaForm(true); break;
      case 'environments': setShowEnvForm(true); break;
      case 'signage': setShowSignForm(true); break;
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'WHS Hub', headerShown: true, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text }} />

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Feather name="alert-triangle" size={20} color="#f59e0b" />
                <Text style={styles.statNumber}>{openIncidents}</Text>
                <Text style={styles.statLabel}>Open</Text>
              </View>
              <View style={styles.statCard}>
                <Feather name="phone" size={20} color="#22c55e" />
                <Text style={styles.statNumber}>{emergencyInfo.length}</Text>
                <Text style={styles.statLabel}>Plans</Text>
              </View>
              <View style={styles.statCard}>
                <Feather name="clipboard" size={20} color="#3b82f6" />
                <Text style={styles.statNumber}>{jsaDocs.length}</Text>
                <Text style={styles.statLabel}>JSAs</Text>
              </View>
              <View style={styles.statCard}>
                <Feather name="activity" size={20} color="#8b5cf6" />
                <Text style={styles.statNumber}>{incidents.length}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
              <View style={styles.tabsRow}>
                {TABS.map(tab => (
                  <TouchableOpacity key={tab.key} style={[styles.tab, activeTab === tab.key && styles.tabActive]} onPress={() => setActiveTab(tab.key)}>
                    <Feather name={tab.icon} size={14} color={activeTab === tab.key ? '#fff' : colors.textSecondary} />
                    <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={{ paddingHorizontal: spacing.md, paddingBottom: 100 }}>
              {activeTab === 'incidents' && renderIncidents()}
              {activeTab === 'emergency' && renderEmergency()}
              {activeTab === 'jsa' && renderJsa()}
              {activeTab === 'environments' && renderEnvironments()}
              {activeTab === 'signage' && renderSignage()}
            </View>
          </ScrollView>

          {showFab && (
            <TouchableOpacity style={styles.fab} onPress={fabAction}>
              <Feather name="plus" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </>
      )}

      {renderIncidentModal()}
      {renderEmergencyModal()}
      {renderJsaModal()}
      {renderEnvModal()}
      {renderSignModal()}
    </View>
  );
}
