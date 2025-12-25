import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
  Linking,
  Dimensions
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api, { API_URL } from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, radius } from '../../src/lib/design-tokens';

// Step configuration with colors
const STEP_CONFIG = {
  business: { 
    title: 'Business Setup', 
    icon: 'business' as const,
    color: '#2563eb', // blue
    lightColor: '#dbeafe',
  },
  integrations: { 
    title: 'Payments', 
    icon: 'card' as const,
    color: '#8b5cf6', // purple
    lightColor: '#ede9fe',
  },
  team: { 
    title: 'Team', 
    icon: 'people' as const,
    color: '#f97316', // orange
    lightColor: '#fed7aa',
  },
  complete: { 
    title: 'Done!', 
    icon: 'checkmark-circle' as const,
    color: '#22c55e', // green
    lightColor: '#dcfce7',
  },
};

type OnboardingStep = 'business' | 'integrations' | 'team' | 'complete';

const tradeTypes = [
  { value: 'electrical', label: 'Electrical', icon: 'flash' as const },
  { value: 'plumbing', label: 'Plumbing', icon: 'water' as const },
  { value: 'carpentry', label: 'Carpentry', icon: 'hammer' as const },
  { value: 'hvac', label: 'HVAC', icon: 'snow' as const },
  { value: 'painting', label: 'Painting', icon: 'brush' as const },
  { value: 'roofing', label: 'Roofing', icon: 'home' as const },
  { value: 'landscaping', label: 'Landscaping', icon: 'leaf' as const },
  { value: 'other', label: 'Other', icon: 'construct' as const },
];

const teamSizes = [
  { value: 'solo', label: 'Just Me', description: 'Solo tradie', icon: 'person' as const },
  { value: 'small', label: '2-5', description: 'Small team', icon: 'people' as const },
  { value: 'medium', label: '6-10', description: 'Growing business', icon: 'business' as const },
  { value: 'large', label: '10+', description: 'Large operation', icon: 'globe' as const },
];

export default function OnboardingSetupScreen() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('business');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSettings, setIsCheckingSettings] = useState(true);
  
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { user, businessSettings, setBusinessSettings, fetchBusinessSettings } = useAuthStore();

  const [businessData, setBusinessData] = useState({
    teamSize: businessSettings?.teamSize || '',
    businessName: businessSettings?.businessName || '',
    tradeType: businessSettings?.tradeType || '',
    abn: businessSettings?.abn || '',
    phone: businessSettings?.phone || '',
    address: businessSettings?.address || '',
    gstEnabled: businessSettings?.gstEnabled ?? true,
    defaultHourlyRate: String(businessSettings?.defaultHourlyRate || '120'),
    calloutFee: String(businessSettings?.calloutFee || '90'),
  });

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        await fetchBusinessSettings();
        const settings = useAuthStore.getState().businessSettings;
        
        if (settings?.onboardingCompleted) {
          router.replace('/(tabs)');
          return;
        }
        
        if (settings) {
          setBusinessData(prev => ({
            ...prev,
            teamSize: settings.teamSize || '',
            businessName: settings.businessName || '',
            tradeType: settings.tradeType || '',
            abn: settings.abn || '',
            phone: settings.phone || '',
            address: settings.address || '',
            gstEnabled: settings.gstEnabled ?? true,
            defaultHourlyRate: String(settings.defaultHourlyRate || '120'),
            calloutFee: String(settings.calloutFee || '90'),
          }));
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
      } finally {
        setIsCheckingSettings(false);
      }
    };
    checkOnboardingStatus();
  }, []);

  const [teamInvites, setTeamInvites] = useState<{ email: string; role: string }[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('staff');
  const [sendingInvites, setSendingInvites] = useState(false);

  const isTeamMode = businessData.teamSize && businessData.teamSize !== 'solo';

  const getProgress = () => {
    const steps = isTeamMode 
      ? ['business', 'integrations', 'team', 'complete']
      : ['business', 'integrations', 'complete'];
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  const handleSaveBusinessSettings = async () => {
    if (!businessData.teamSize || !businessData.businessName || !businessData.tradeType) {
      Alert.alert('Missing Info', 'Please select team size, business name, and trade type');
      return;
    }

    setIsLoading(true);
    try {
      const settingsPayload = {
        teamSize: businessData.teamSize,
        businessName: businessData.businessName,
        tradeType: businessData.tradeType,
        abn: businessData.abn || null,
        phone: businessData.phone || null,
        address: businessData.address || null,
        gstEnabled: businessData.gstEnabled,
        defaultHourlyRate: Number(businessData.defaultHourlyRate) || 120,
        calloutFee: Number(businessData.calloutFee) || 90,
      };

      const existingSettings = useAuthStore.getState().businessSettings;
      let response;
      
      if (existingSettings?.id) {
        response = await api.patch('/api/business-settings', settingsPayload);
      } else {
        response = await api.post('/api/business-settings', settingsPayload);
      }

      if (response.error) {
        Alert.alert('Error', response.error);
        return;
      }

      await fetchBusinessSettings();
      setCurrentStep('integrations');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectStripe = async () => {
    try {
      setIsLoading(true);
      const response = await api.post('/api/stripe-connect/onboard');
      
      if (response.error) {
        Alert.alert('Connection Failed', response.error);
        return;
      }

      if (response.data?.onboardingUrl) {
        await Linking.openURL(response.data.onboardingUrl);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to connect Stripe');
    } finally {
      setIsLoading(false);
    }
  };

  const markOnboardingComplete = async () => {
    try {
      await api.patch('/api/business-settings', { onboardingCompleted: true });
      await fetchBusinessSettings();
    } catch (error) {
      console.error('Failed to mark onboarding complete:', error);
    }
  };

  const handleSkipIntegrations = async () => {
    if (isTeamMode) {
      setCurrentStep('team');
    } else {
      await markOnboardingComplete();
      setCurrentStep('complete');
    }
  };

  const handleContinueFromIntegrations = async () => {
    if (isTeamMode) {
      setCurrentStep('team');
    } else {
      await markOnboardingComplete();
      setCurrentStep('complete');
    }
  };

  const handleAddInvite = () => {
    if (!inviteEmail.trim()) return;
    if (teamInvites.some(i => i.email === inviteEmail.trim())) {
      Alert.alert('Already Added', 'This email is already in the invite list');
      return;
    }
    setTeamInvites(prev => [...prev, { email: inviteEmail.trim(), role: inviteRole }]);
    setInviteEmail('');
    setInviteRole('staff');
  };

  const handleRemoveInvite = (email: string) => {
    setTeamInvites(prev => prev.filter(i => i.email !== email));
  };

  const handleSendInvites = async () => {
    if (teamInvites.length === 0) {
      await markOnboardingComplete();
      setCurrentStep('complete');
      return;
    }

    setSendingInvites(true);
    try {
      for (const invite of teamInvites) {
        await api.post('/api/team/invite', {
          email: invite.email,
          roleId: invite.role
        });
      }
      await markOnboardingComplete();
      Alert.alert('Success', `${teamInvites.length} invite${teamInvites.length > 1 ? 's' : ''} sent!`);
      setCurrentStep('complete');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send some invites');
    } finally {
      setSendingInvites(false);
    }
  };

  const handleSkipTeam = async () => {
    await markOnboardingComplete();
    setCurrentStep('complete');
  };

  const handleComplete = () => {
    router.replace('/(tabs)');
  };

  const renderBusinessStep = () => (
    <ScrollView 
      style={styles.stepContainer} 
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.stepHeader}>
        <View style={styles.iconCircle}>
          <Ionicons name="business" size={32} color={colors.primary} />
        </View>
        <Text style={styles.stepTitle}>Your Business</Text>
        <Text style={styles.stepSubtitle}>Tell us about your trade business</Text>
      </View>

      <Text style={styles.sectionLabel}>Team Size</Text>
      <View style={styles.optionsGrid}>
        {teamSizes.map((size) => (
          <TouchableOpacity
            key={size.value}
            style={[
              styles.optionCard,
              businessData.teamSize === size.value && styles.optionCardSelected
            ]}
            onPress={() => setBusinessData(prev => ({ ...prev, teamSize: size.value }))}
            testID={`option-team-${size.value}`}
          >
            <Ionicons 
              name={size.icon} 
              size={24} 
              color={businessData.teamSize === size.value ? colors.primary : colors.mutedForeground} 
            />
            <Text style={[
              styles.optionLabel,
              businessData.teamSize === size.value && styles.optionLabelSelected
            ]}>{size.label}</Text>
            <Text style={styles.optionDescription}>{size.description}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Trade Type</Text>
      <View style={styles.tradeGrid}>
        {tradeTypes.map((trade) => (
          <TouchableOpacity
            key={trade.value}
            style={[
              styles.tradeOption,
              businessData.tradeType === trade.value && styles.tradeOptionSelected
            ]}
            onPress={() => setBusinessData(prev => ({ ...prev, tradeType: trade.value }))}
            testID={`option-trade-${trade.value}`}
          >
            <Ionicons 
              name={trade.icon} 
              size={18} 
              color={businessData.tradeType === trade.value ? colors.primary : colors.mutedForeground} 
            />
            <Text style={[
              styles.tradeLabel,
              businessData.tradeType === trade.value && styles.tradeLabelSelected
            ]}>{trade.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Business Details</Text>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Business Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Smith Electrical"
          placeholderTextColor={colors.mutedForeground}
          value={businessData.businessName}
          onChangeText={(text) => setBusinessData(prev => ({ ...prev, businessName: text }))}
          testID="input-business-name"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>ABN (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="12 345 678 901"
          placeholderTextColor={colors.mutedForeground}
          value={businessData.abn}
          onChangeText={(text) => setBusinessData(prev => ({ ...prev, abn: text }))}
          keyboardType="number-pad"
          testID="input-abn"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Phone (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="0412 345 678"
          placeholderTextColor={colors.mutedForeground}
          value={businessData.phone}
          onChangeText={(text) => setBusinessData(prev => ({ ...prev, phone: text }))}
          keyboardType="phone-pad"
          testID="input-phone"
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: spacing.sm }]}>
          <Text style={styles.inputLabel}>Hourly Rate</Text>
          <TextInput
            style={styles.input}
            placeholder="120"
            placeholderTextColor={colors.mutedForeground}
            value={businessData.defaultHourlyRate}
            onChangeText={(text) => setBusinessData(prev => ({ ...prev, defaultHourlyRate: text }))}
            keyboardType="number-pad"
            testID="input-hourly-rate"
          />
        </View>
        <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing.sm }]}>
          <Text style={styles.inputLabel}>Callout Fee</Text>
          <TextInput
            style={styles.input}
            placeholder="90"
            placeholderTextColor={colors.mutedForeground}
            value={businessData.calloutFee}
            onChangeText={(text) => setBusinessData(prev => ({ ...prev, calloutFee: text }))}
            keyboardType="number-pad"
            testID="input-callout-fee"
          />
        </View>
      </View>

      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.inputLabel}>GST Registration</Text>
          <Text style={styles.switchDescription}>Include 10% GST in quotes and invoices</Text>
        </View>
        <Switch
          value={businessData.gstEnabled}
          onValueChange={(value) => setBusinessData(prev => ({ ...prev, gstEnabled: value }))}
          trackColor={{ false: colors.cardBorder, true: colors.primary }}
          thumbColor={colors.card}
          testID="switch-gst"
        />
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={{
            backgroundColor: '#1e3a5f',
            paddingVertical: 14,
            paddingHorizontal: spacing.xl,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            opacity: (isLoading || !businessData.teamSize || !businessData.businessName || !businessData.tradeType) ? 0.5 : 1,
          }}
          onPress={handleSaveBusinessSettings}
          disabled={isLoading || !businessData.teamSize || !businessData.businessName || !businessData.tradeType}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderIntegrationsStep = () => (
    <ScrollView 
      style={styles.stepContainer} 
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.stepHeader}>
        <View style={[styles.iconCircle, { backgroundColor: '#8b5cf6' + '20' }]}>
          <Ionicons name="card" size={32} color="#8b5cf6" />
        </View>
        <Text style={styles.stepTitle}>Get Paid Faster</Text>
        <Text style={styles.stepSubtitle}>Connect Stripe to accept card payments directly to your bank</Text>
      </View>

      <Card style={styles.integrationCard}>
        <CardContent style={{ paddingTop: spacing.xl }}>
          <View style={styles.integrationHeader}>
            <View style={[styles.integrationIcon, { backgroundColor: '#6366f1' + '20' }]}>
              <Ionicons name="logo-usd" size={24} color="#6366f1" />
            </View>
            <View style={styles.integrationInfo}>
              <Text style={styles.integrationTitle}>Stripe Payments</Text>
              <Text style={styles.integrationDescription}>
                Accept credit cards, debit cards, and bank transfers. Get paid in 2-3 business days.
              </Text>
            </View>
          </View>

          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.featureText}>2.9% + 30c per transaction</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.featureText}>Instant setup, no monthly fees</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.featureText}>Accept payments from invoice links</Text>
            </View>
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: '#6366f1',
              paddingVertical: 14,
              paddingHorizontal: spacing.xl,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
            }}
            onPress={handleConnectStripe}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Connect Stripe Account</Text>
            )}
          </TouchableOpacity>
        </CardContent>
      </Card>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color={colors.primary} />
        <Text style={styles.infoText}>
          You can always set this up later from Settings → Integrations
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={styles.skipButton} 
          onPress={handleSkipIntegrations}
          testID="button-skip-integrations"
        >
          <Text style={styles.skipText}>Skip for now</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={{
          backgroundColor: '#1e3a5f',
          paddingVertical: 14,
          paddingHorizontal: spacing.xl,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        }}
        onPress={handleContinueFromIntegrations}
        activeOpacity={0.8}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Continue</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderTeamStep = () => (
    <ScrollView 
      style={styles.stepContainer} 
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.stepHeader}>
        <View style={[styles.iconCircle, { backgroundColor: colors.warning + '20' }]}>
          <Ionicons name="people" size={32} color={colors.warning} />
        </View>
        <Text style={styles.stepTitle}>Invite Your Team</Text>
        <Text style={styles.stepSubtitle}>Add team members so they can start using TradieTrack</Text>
      </View>

      <Card>
        <CardContent>
          <View style={styles.inviteInputRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="team@example.com"
              placeholderTextColor={colors.mutedForeground}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              testID="input-invite-email"
            />
            <TouchableOpacity
              style={styles.roleSelector}
              onPress={() => {
                const roles = ['staff', 'supervisor', 'admin'];
                const currentIndex = roles.indexOf(inviteRole);
                setInviteRole(roles[(currentIndex + 1) % roles.length]);
              }}
              testID="button-role-toggle"
            >
              <Text style={styles.roleText}>{inviteRole}</Text>
              <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddInvite}
              testID="button-add-invite"
            >
              <Ionicons name="add" size={24} color={colors.card} />
            </TouchableOpacity>
          </View>

          {teamInvites.length > 0 && (
            <View style={styles.inviteList}>
              <Text style={styles.inviteListLabel}>Pending Invites</Text>
              {teamInvites.map((invite, idx) => (
                <View key={idx} style={styles.inviteItem}>
                  <View style={styles.inviteItemInfo}>
                    <Ionicons name="mail" size={16} color={colors.mutedForeground} />
                    <Text style={styles.inviteEmail}>{invite.email}</Text>
                    <View style={styles.roleBadge}>
                      <Text style={styles.roleBadgeText}>{invite.role}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveInvite(invite.email)}
                    testID={`button-remove-invite-${idx}`}
                  >
                    <Ionicons name="close" size={20} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </CardContent>
      </Card>

      <View style={styles.infoBox}>
        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
        <Text style={styles.infoText}>
          Team members will receive an email with instructions to join your business
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={styles.skipButton} 
          onPress={handleSkipTeam}
          testID="button-skip-team"
        >
          <Text style={styles.skipText}>Skip for now</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={{
          backgroundColor: '#1e3a5f',
          paddingVertical: 14,
          paddingHorizontal: spacing.xl,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          opacity: sendingInvites ? 0.5 : 1,
        }}
        onPress={handleSendInvites}
        disabled={sendingInvites}
        activeOpacity={0.8}
      >
        {sendingInvites ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
            {teamInvites.length > 0 ? `Send ${teamInvites.length} Invite${teamInvites.length > 1 ? 's' : ''}` : 'Continue'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  const renderCompleteStep = () => (
    <View style={styles.completeContainer}>
      <View style={styles.completeContent}>
        <LinearGradient
          colors={['#22c55e', '#16a34a']}
          style={styles.successCircle}
        >
          <Ionicons name="checkmark" size={48} color="#fff" />
        </LinearGradient>
        
        <Text style={styles.completeTitle}>You're All Set!</Text>
        <Text style={styles.completeSubtitle}>
          Your business is ready to use TradieTrack. Start managing your jobs, quotes, and invoices.
        </Text>

        <View style={styles.checkList}>
          <View style={styles.checkItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.checkText}>Business profile created</Text>
          </View>
          {businessSettings?.stripeConnected && (
            <View style={styles.checkItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.checkText}>Stripe payments connected</Text>
            </View>
          )}
          {teamInvites.length > 0 && (
            <View style={styles.checkItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.checkText}>{teamInvites.length} team invite{teamInvites.length > 1 ? 's' : ''} sent</Text>
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={{
          backgroundColor: '#1e3a5f',
          paddingVertical: 14,
          paddingHorizontal: spacing.xl,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        }}
        onPress={handleComplete}
        activeOpacity={0.8}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Go to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );

  const renderProgressBar = () => {
    const steps = isTeamMode 
      ? ['business', 'integrations', 'team', 'complete'] as OnboardingStep[]
      : ['business', 'integrations', 'complete'] as OnboardingStep[];
    
    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${getProgress()}%` }]} />
        </View>
        <View style={styles.stepsRow}>
          {steps.map((step, index) => {
            const config = STEP_CONFIG[step];
            const isActive = steps.indexOf(currentStep) >= index;
            const isCurrent = currentStep === step;
            
            return (
              <View key={step} style={styles.stepIndicator}>
                <View style={[
                  styles.stepDot,
                  isActive && { backgroundColor: config.color },
                  isCurrent && styles.stepDotCurrent
                ]}>
                  <Ionicons 
                    name={config.icon} 
                    size={14} 
                    color={isActive ? '#fff' : colors.mutedForeground} 
                  />
                </View>
                <Text style={[
                  styles.stepLabel,
                  isActive && { color: config.color }
                ]}>{config.title}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  if (isCheckingSettings) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderProgressBar()}
      {currentStep === 'business' && renderBusinessStep()}
      {currentStep === 'integrations' && renderIntegrationsStep()}
      {currentStep === 'team' && renderTeamStep()}
      {currentStep === 'complete' && renderCompleteStep()}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  progressBar: {
    height: spacing.xs,
    backgroundColor: colors.cardBorder,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepIndicator: {
    alignItems: 'center',
    flex: 1,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  stepDotCurrent: {
    transform: [{ scale: 1.1 }],
  },
  stepLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  stepContainer: {
    flex: 1,
  },
  stepContent: {
    padding: spacing.xl,
    paddingBottom: 40,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius['3xl'],
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  stepSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  optionCard: {
    width: (Dimensions.get('window').width - 52) / 2,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  optionLabelSelected: {
    color: colors.primary,
  },
  optionDescription: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  tradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  tradeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.xs,
  },
  tradeOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  tradeLabel: {
    fontSize: 14,
    color: colors.foreground,
  },
  tradeLabelSelected: {
    color: colors.primary,
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  input: {
    height: 48,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    color: colors.foreground,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  switchText: {
    flex: 1,
  },
  switchDescription: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  buttonRow: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  integrationCard: {
    marginBottom: spacing.lg,
  },
  integrationHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  integrationIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  integrationInfo: {
    flex: 1,
  },
  integrationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  integrationDescription: {
    fontSize: 13,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  featureList: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    fontSize: 13,
    color: colors.foreground,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primary + '10',
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.foreground,
    lineHeight: 18,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  skipText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  inviteInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  roleSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    height: 48,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.xs,
  },
  roleText: {
    fontSize: 13,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteList: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  inviteListLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  inviteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radius.sm,
  },
  inviteItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  inviteEmail: {
    fontSize: 14,
    color: colors.foreground,
    flex: 1,
  },
  roleBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  roleBadgeText: {
    fontSize: 11,
    color: colors.primary,
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  completeContainer: {
    padding: spacing.xl,
    justifyContent: 'center',
  },
  completeContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.success,
    marginBottom: spacing.sm,
    marginTop: spacing['2xl'],
  },
  completeSubtitle: {
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing['3xl'],
  },
  checkList: {
    gap: spacing.md,
    alignSelf: 'stretch',
    paddingHorizontal: spacing['2xl'],
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  checkText: {
    fontSize: 15,
    color: colors.foreground,
  },
});
