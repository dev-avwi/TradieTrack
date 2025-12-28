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
        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
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
        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
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
            paddingHorizontal: 20,
            borderRadius: 10,
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
        <CardContent style={{ paddingTop: 20 }}>
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
              paddingHorizontal: 20,
              borderRadius: 10,
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
          paddingHorizontal: 20,
          borderRadius: 10,
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
          paddingHorizontal: 20,
          borderRadius: 10,
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
            {teamInvites.length > 0 
              ? `Send ${teamInvites.length} Invite${teamInvites.length > 1 ? 's' : ''}`
              : 'Continue'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  const renderCompleteStep = () => (
    <View style={[styles.stepContainer, styles.completeContainer]}>
      <View style={styles.completeContent}>
        <View style={[styles.iconCircle, styles.successCircle]}>
          <Ionicons name="checkmark" size={48} color={colors.card} />
        </View>
        
        <Text style={styles.completeTitle}>Welcome to TradieTrack!</Text>
        <Text style={styles.completeSubtitle}>Your account is ready. Let's get you some jobs!</Text>

        <View style={styles.checkList}>
          <View style={styles.checkItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.checkText}>Business details configured</Text>
          </View>
          <View style={styles.checkItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.checkText}>Ready to create quotes, jobs & invoices</Text>
          </View>
          {isTeamMode && teamInvites.length > 0 && (
            <View style={styles.checkItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.checkText}>{teamInvites.length} team invite{teamInvites.length > 1 ? 's' : ''} sent</Text>
            </View>
          )}
        </View>
        
        <View style={styles.freePlanCard}>
          <Text style={styles.freePlanTitle}>Free Plan Includes:</Text>
          <View style={styles.freePlanList}>
            <Text style={styles.freePlanItem}>Unlimited quotes</Text>
            <Text style={styles.freePlanItem}>25 jobs per month</Text>
            <Text style={styles.freePlanItem}>25 invoices per month</Text>
            <Text style={styles.freePlanItem}>50 clients</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={{
          backgroundColor: '#1e3a5f',
          paddingVertical: 14,
          paddingHorizontal: 20,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        }}
        onPress={handleComplete}
        activeOpacity={0.8}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Start Using TradieTrack</Text>
      </TouchableOpacity>
    </View>
  );

  const allSteps: OnboardingStep[] = isTeamMode 
    ? ['business', 'integrations', 'team', 'complete']
    : ['business', 'integrations', 'complete'];

  const currentStepConfig = STEP_CONFIG[currentStep];

  if (isCheckingSettings) {
    return (
      <LinearGradient
        colors={['#2563eb', '#3b82f6', '#f97316']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientContainer}
      >
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
          <View style={styles.loadingContainer}>
            <View style={styles.loadingCircle}>
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
            <Text style={styles.loadingTextWhite}>Setting up your account...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#2563eb', '#3b82f6', '#f97316']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {/* Header with logo and step indicators */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Text style={styles.logoText}>
              <Text style={{ color: '#FFFFFF' }}>Tradie</Text>
              <Text style={{ color: '#fed7aa' }}>Track</Text>
            </Text>
          </View>
          
          {/* Step indicators */}
          <View style={styles.stepIndicators}>
            {allSteps.map((step, index) => {
              const stepConfig = STEP_CONFIG[step];
              const currentIndex = allSteps.indexOf(currentStep);
              const isActive = step === currentStep;
              const isCompleted = index < currentIndex;
              
              return (
                <View key={step} style={styles.stepIndicatorWrapper}>
                  <View style={[
                    styles.stepDot,
                    isActive && { backgroundColor: '#FFFFFF', transform: [{ scale: 1.2 }] },
                    isCompleted && { backgroundColor: '#22c55e' },
                    !isActive && !isCompleted && { backgroundColor: 'rgba(255,255,255,0.3)' }
                  ]}>
                    {isCompleted && (
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    )}
                    {isActive && (
                      <Ionicons name={stepConfig.icon} size={12} color={stepConfig.color} />
                    )}
                  </View>
                  <Text style={[
                    styles.stepLabel,
                    isActive && { color: '#FFFFFF', fontWeight: '600' },
                    !isActive && { color: 'rgba(255,255,255,0.6)' }
                  ]}>
                    {stepConfig.title}
                  </Text>
                  {index < allSteps.length - 1 && (
                    <View style={[
                      styles.stepConnector,
                      isCompleted && { backgroundColor: '#22c55e' }
                    ]} />
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBarWhite}>
            <View style={[styles.progressFillOrange, { width: `${getProgress()}%` }]} />
          </View>
          <Text style={styles.progressTextWhite}>{Math.round(getProgress())}%</Text>
        </View>

        {/* Content card */}
        <View style={styles.contentCard}>
          {/* Step header with color */}
          <View style={[styles.stepHeaderBar, { backgroundColor: currentStepConfig.lightColor }]}>
            <View style={[styles.stepHeaderIcon, { backgroundColor: currentStepConfig.color }]}>
              <Ionicons name={currentStepConfig.icon} size={20} color="#FFFFFF" />
            </View>
            <Text style={[styles.stepHeaderTitle, { color: currentStepConfig.color }]}>
              {currentStepConfig.title}
            </Text>
          </View>

          {currentStep === 'business' && renderBusinessStep()}
          {currentStep === 'integrations' && renderIntegrationsStep()}
          {currentStep === 'team' && renderTeamStep()}
          {currentStep === 'complete' && renderCompleteStep()}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  stepIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stepIndicatorWrapper: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  stepConnector: {
    position: 'absolute',
    top: 14,
    left: '60%',
    right: '-40%',
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    zIndex: -1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTextWhite: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 12,
  },
  progressBarWhite: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFillOrange: {
    height: '100%',
    backgroundColor: '#f97316',
    borderRadius: 3,
  },
  progressTextWhite: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    minWidth: 35,
    textAlign: 'right',
  },
  contentCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 8,
    overflow: 'hidden',
  },
  stepHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  stepHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  stepContainer: {
    flex: 1,
  },
  stepContent: {
    padding: 20,
    paddingBottom: 40,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 12,
    marginTop: 8,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  optionCard: {
    width: (Dimensions.get('window').width - 52) / 2,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    gap: 8,
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
    gap: 8,
    marginBottom: 20,
  },
  tradeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 6,
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
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: 8,
  },
  input: {
    height: 48,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
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
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
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
    marginTop: 8,
    marginBottom: 16,
  },
  integrationCard: {
    marginBottom: 16,
  },
  integrationHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  integrationIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
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
    marginBottom: 4,
  },
  integrationDescription: {
    fontSize: 13,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  featureList: {
    marginBottom: 16,
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    color: colors.foreground,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primary + '10',
    padding: 12,
    borderRadius: 10,
    gap: 10,
    marginBottom: 16,
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
    gap: 6,
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  inviteInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  roleSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 48,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 4,
  },
  roleText: {
    fontSize: 13,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteList: {
    marginTop: 16,
    gap: 8,
  },
  inviteListLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  inviteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
  },
  inviteItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  inviteEmail: {
    fontSize: 14,
    color: colors.foreground,
    flex: 1,
  },
  roleBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 11,
    color: colors.primary,
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  completeContainer: {
    padding: 20,
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
  },
  completeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.success,
    marginBottom: 8,
    marginTop: 24,
  },
  completeSubtitle: {
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 32,
  },
  checkList: {
    gap: 12,
    alignSelf: 'stretch',
    paddingHorizontal: 24,
  },
  freePlanCard: {
    backgroundColor: colors.muted,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    alignSelf: 'stretch',
    marginHorizontal: 24,
  },
  freePlanTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 8,
  },
  freePlanList: {
    gap: 4,
  },
  freePlanItem: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkText: {
    fontSize: 15,
    color: colors.foreground,
  },
});
