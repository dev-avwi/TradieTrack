import { useState, useEffect, useRef } from 'react';
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
import { validateABN, formatABN } from '../../src/lib/format';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

type OnboardingRole = 'owner' | 'worker' | 'subcontractor' | null;

type OwnerStep = 'role' | 'business' | 'trade' | 'teamSize' | 'complete';
type WorkerStep = 'role' | 'inviteCode' | 'workerDetails' | 'complete';
type SubcontractorStep = 'role' | 'subDetails' | 'subConnect' | 'privacy' | 'complete';

const tradeTypes = [
  { value: 'electrical', label: 'Electrical', icon: 'flash' as const },
  { value: 'plumbing', label: 'Plumbing', icon: 'water' as const },
  { value: 'carpentry', label: 'Carpentry', icon: 'hammer' as const },
  { value: 'hvac', label: 'HVAC', icon: 'snow' as const },
  { value: 'painting', label: 'Painting', icon: 'brush' as const },
  { value: 'landscaping', label: 'Landscaping', icon: 'leaf' as const },
  { value: 'building', label: 'Building', icon: 'home' as const },
  { value: 'other', label: 'General/Other', icon: 'construct' as const },
];

const teamSizes = [
  { value: 'solo', label: 'Just Me', description: 'Solo tradie', icon: 'person' as const },
  { value: 'small', label: '2-5', description: 'Small team', icon: 'people' as const },
  { value: 'medium', label: '6-10', description: 'Growing', icon: 'business' as const },
  { value: 'large', label: '10+', description: 'Large op', icon: 'globe' as const },
];


export default function OnboardingSetupScreen() {
  const [selectedRole, setSelectedRole] = useState<OnboardingRole>(null);
  const [ownerStep, setOwnerStep] = useState<OwnerStep>('role');
  const [workerStep, setWorkerStep] = useState<WorkerStep>('role');
  const [subStep, setSubStep] = useState<SubcontractorStep>('role');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSettings, setIsCheckingSettings] = useState(true);
  
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { user, businessSettings, setBusinessSettings, fetchBusinessSettings } = useAuthStore();

  const [businessData, setBusinessData] = useState({
    teamSize: '',
    businessName: '',
    tradeType: '',
    abn: '',
    phone: '',
    ownerName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '',
    gstEnabled: true,
    defaultHourlyRate: '120',
    calloutFee: '90',
  });

  const [inviteCode, setInviteCode] = useState('');
  const [inviteValidation, setInviteValidation] = useState<{ valid: boolean; businessName?: string; roleType?: string; ownerName?: string; error?: string } | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const validateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [workerName, setWorkerName] = useState(user?.firstName || '');
  const [workerLastName, setWorkerLastName] = useState(user?.lastName || '');
  const [workerPhone, setWorkerPhone] = useState('');

  const [subName, setSubName] = useState(user?.firstName || '');
  const [subLastName, setSubLastName] = useState(user?.lastName || '');
  const [subPhone, setSubPhone] = useState('');
  const [subTradeType, setSubTradeType] = useState('');
  const [subAbn, setSubAbn] = useState('');
  const [subInviteCode, setSubInviteCode] = useState('');
  const [subInviteValidation, setSubInviteValidation] = useState<{ valid: boolean; businessName?: string; roleType?: string; ownerName?: string; error?: string } | null>(null);
  const [isValidatingSubCode, setIsValidatingSubCode] = useState(false);
  const subValidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [demoDataSeeded, setDemoDataSeeded] = useState(false);

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
            gstEnabled: settings.gstEnabled ?? true,
            defaultHourlyRate: String(settings.defaultHourlyRate || '120'),
            calloutFee: String(settings.calloutFee || '90'),
          }));

          if (settings.businessName && settings.tradeType) {
            setSelectedRole('owner');
            if (settings.teamSize) {
              setOwnerStep('complete');
            } else {
              setOwnerStep('teamSize');
            }
          } else if (settings.businessName) {
            setSelectedRole('owner');
            setOwnerStep('trade');
          }
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
      } finally {
        setIsCheckingSettings(false);
      }
    };
    checkOnboardingStatus();
  }, []);

  const validateInviteCode = async (code: string, isSub = false) => {
    const setValidation = isSub ? setSubInviteValidation : setInviteValidation;
    const setValidating = isSub ? setIsValidatingSubCode : setIsValidatingCode;

    if (code.length !== 6) {
      setValidation(null);
      return;
    }

    setValidating(true);
    try {
      const response = await api.get(`/api/team/invite-code/validate/${code.toUpperCase()}`);
      setValidation(response.data as { valid: boolean; businessName?: string; roleType?: string; ownerName?: string; error?: string });
    } catch (error) {
      setValidation({ valid: false, error: 'Failed to validate code' });
    } finally {
      setValidating(false);
    }
  };

  const handleInviteCodeChange = (text: string, isSub = false) => {
    const clean = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (isSub) {
      setSubInviteCode(clean);
      if (subValidateTimer.current) clearTimeout(subValidateTimer.current);
      if (clean.length === 6) {
        subValidateTimer.current = setTimeout(() => validateInviteCode(clean, true), 300);
      } else {
        setSubInviteValidation(null);
      }
    } else {
      setInviteCode(clean);
      if (validateTimer.current) clearTimeout(validateTimer.current);
      if (clean.length === 6) {
        validateTimer.current = setTimeout(() => validateInviteCode(clean, false), 300);
      } else {
        setInviteValidation(null);
      }
    }
  };

  const handleSaveBusinessSettings = async (): Promise<boolean> => {
    if (!businessData.businessName || !businessData.tradeType) {
      Alert.alert('Missing Info', 'Please enter business name and trade type');
      return false;
    }

    if (businessData.abn) {
      const abnResult = validateABN(businessData.abn);
      if (!abnResult.valid) {
        Alert.alert('Invalid ABN', abnResult.error || 'Please enter a valid 11-digit ABN');
        return false;
      }
    }

    setIsLoading(true);
    try {
      const settingsPayload = {
        teamSize: businessData.teamSize || 'solo',
        businessName: businessData.businessName,
        tradeType: businessData.tradeType,
        abn: businessData.abn || null,
        phone: businessData.phone || null,
        gstEnabled: businessData.gstEnabled,
        defaultHourlyRate: Number(businessData.defaultHourlyRate) || 120,
        calloutFee: Number(businessData.calloutFee) || 90,
      };

      const existingSettings = useAuthStore.getState().businessSettings;
      if (existingSettings?.id) {
        await api.patch('/api/business-settings', settingsPayload);
      } else {
        await api.post('/api/business-settings', settingsPayload);
      }
      await fetchBusinessSettings();
      return true;
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save settings');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const markOnboardingComplete = async () => {
    try {
      try {
        await api.post('/api/onboarding/seed-demo-data', {});
        setDemoDataSeeded(true);
      } catch (error) {
        if (__DEV__) console.log('Demo data seeding skipped:', error);
      }
      
      await api.post('/api/onboarding/complete', {});
      await fetchBusinessSettings();
    } catch (error) {
      console.error('Failed to mark onboarding complete:', error);
    }
  };

  const handleOwnerComplete = async () => {
    const saved = await handleSaveBusinessSettings();
    if (!saved) return;
    await markOnboardingComplete();
    setOwnerStep('complete');
  };

  const handleWorkerRedeem = async () => {
    if (!inviteValidation?.valid) {
      Alert.alert('Invalid Code', 'Please enter a valid invite code');
      return;
    }

    if (!workerName.trim()) {
      Alert.alert('Missing Info', 'Please enter your name');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/api/team/invite-code/redeem', {
        code: inviteCode,
        phone: workerPhone || undefined,
      });

      if (response.error) {
        Alert.alert('Error', response.error);
        return;
      }

      if (workerName.trim() || workerLastName.trim()) {
        await api.patch('/api/user/profile', {
          firstName: workerName.trim(),
          lastName: workerLastName.trim(),
        });
      }

      await api.post('/api/onboarding/complete', {}).catch(() => {});
      await fetchBusinessSettings();
      
      setWorkerStep('complete');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to join team');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubDetailsNext = async () => {
    if (!subName.trim()) {
      Alert.alert('Missing Info', 'Please enter your name');
      return;
    }

    setIsLoading(true);
    try {
      await api.patch('/api/user/profile', {
        firstName: subName.trim(),
        lastName: subLastName.trim(),
        tradeType: subTradeType || undefined,
      });

      const existingSettings = useAuthStore.getState().businessSettings;
      const settingsPayload = {
        businessName: `${subName.trim()}'s Services`,
        tradeType: subTradeType || 'other',
        phone: subPhone || null,
        abn: subAbn || null,
        teamSize: 'solo',
      };

      if (existingSettings?.id) {
        await api.patch('/api/business-settings', settingsPayload);
      } else {
        await api.post('/api/business-settings', settingsPayload);
      }
      await fetchBusinessSettings();
      setSubStep('subConnect');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubConnect = async (skip: boolean) => {
    if (!skip && subInviteValidation?.valid) {
      setIsLoading(true);
      try {
        const response = await api.post('/api/team/invite-code/redeem', {
          code: subInviteCode,
          phone: subPhone || undefined,
        });

        if (response.error) {
          Alert.alert('Error', response.error);
          setIsLoading(false);
          return;
        }
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to connect');
        setIsLoading(false);
        return;
      } finally {
        setIsLoading(false);
      }
    }
    setSubStep('privacy');
  };

  const handleSubPrivacyAcknowledge = async () => {
    try {
      await api.post('/api/onboarding/complete', {}).catch(() => {});
      await fetchBusinessSettings();
      setSubStep('complete');
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  const handleComplete = () => {
    router.replace('/(tabs)');
  };

  const getCurrentStep = () => {
    if (!selectedRole) return 'role';
    if (selectedRole === 'owner') return ownerStep;
    if (selectedRole === 'worker') return workerStep;
    return subStep;
  };

  const getStepCount = () => {
    if (!selectedRole) return { current: 1, total: 1 };
    if (selectedRole === 'owner') {
      const steps: OwnerStep[] = ['role', 'business', 'trade', 'teamSize', 'complete'];
      return { current: steps.indexOf(ownerStep) + 1, total: steps.length };
    }
    if (selectedRole === 'worker') {
      const steps: WorkerStep[] = ['role', 'inviteCode', 'workerDetails', 'complete'];
      return { current: steps.indexOf(workerStep) + 1, total: steps.length };
    }
    const steps: SubcontractorStep[] = ['role', 'subDetails', 'subConnect', 'privacy', 'complete'];
    return { current: steps.indexOf(subStep) + 1, total: steps.length };
  };

  const renderRoleSelection = () => (
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <View style={styles.stepHeader}>
        <View style={styles.iconCircle}>
          <Ionicons name="hand-right" size={32} color={colors.primary} />
        </View>
        <Text style={styles.stepTitle}>How are you joining?</Text>
        <Text style={styles.stepSubtitle}>Choose the option that best describes you</Text>
      </View>

      <TouchableOpacity
        style={styles.roleCard}
        onPress={() => {
          setSelectedRole('owner');
          setOwnerStep('business');
        }}
        activeOpacity={0.7}
        testID="role-owner"
      >
        <View style={[styles.roleIconWrap, { backgroundColor: '#2563eb20' }]}>
          <Ionicons name="briefcase" size={28} color="#2563eb" />
        </View>
        <View style={styles.roleCardContent}>
          <Text style={styles.roleCardTitle}>I run a business</Text>
          <Text style={styles.roleCardSubtitle}>Set up your business and start managing jobs</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.roleCard}
        onPress={() => {
          setSelectedRole('worker');
          setWorkerStep('inviteCode');
        }}
        activeOpacity={0.7}
        testID="role-worker"
      >
        <View style={[styles.roleIconWrap, { backgroundColor: '#E8862E20' }]}>
          <Ionicons name="people" size={28} color="#E8862E" />
        </View>
        <View style={styles.roleCardContent}>
          <Text style={styles.roleCardTitle}>I was invited to a team</Text>
          <Text style={styles.roleCardSubtitle}>Join your employer's business with an invite code</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.roleCard}
        onPress={() => {
          setSelectedRole('subcontractor');
          setSubStep('subDetails');
        }}
        activeOpacity={0.7}
        testID="role-subcontractor"
      >
        <View style={[styles.roleIconWrap, { backgroundColor: '#22c55e20' }]}>
          <Ionicons name="construct" size={28} color="#22c55e" />
        </View>
        <View style={styles.roleCardContent}>
          <Text style={styles.roleCardTitle}>I'm a subcontractor</Text>
          <Text style={styles.roleCardSubtitle}>Work for multiple businesses independently</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
      </TouchableOpacity>
    </ScrollView>
  );

  const renderOwnerBusiness = () => (
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <View style={styles.stepHeader}>
        <View style={styles.iconCircle}>
          <Ionicons name="business" size={32} color={colors.primary} />
        </View>
        <Text style={styles.stepTitle}>Business Details</Text>
        <Text style={styles.stepSubtitle}>Tell us about your trade business</Text>
      </View>

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
        <Text style={styles.inputLabel}>Your Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. John Smith"
          placeholderTextColor={colors.mutedForeground}
          value={businessData.ownerName}
          onChangeText={(text) => setBusinessData(prev => ({ ...prev, ownerName: text }))}
          testID="input-owner-name"
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

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>ABN (optional)</Text>
        <TextInput
          style={[styles.input, businessData.abn && !validateABN(businessData.abn).valid ? { borderColor: colors.destructive } : null]}
          placeholder="12 345 678 901"
          placeholderTextColor={colors.mutedForeground}
          value={formatABN(businessData.abn)}
          onChangeText={(text) => {
            const digits = text.replace(/\s/g, '').replace(/[^0-9]/g, '').slice(0, 11);
            setBusinessData(prev => ({ ...prev, abn: digits }));
          }}
          keyboardType="number-pad"
          maxLength={14}
          testID="input-abn"
        />
        {businessData.abn.length > 0 && !validateABN(businessData.abn).valid && (
          <Text style={{ color: colors.destructive, fontSize: 12, marginTop: 4 }}>
            {validateABN(businessData.abn).error}
          </Text>
        )}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.primaryButton} onPress={() => {
          if (!businessData.businessName.trim()) {
            Alert.alert('Required', 'Please enter your business name');
            return;
          }
          setOwnerStep('trade');
        }} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderOwnerTrade = () => (
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <View style={styles.stepHeader}>
        <View style={styles.iconCircle}>
          <Ionicons name="construct" size={32} color={colors.primary} />
        </View>
        <Text style={styles.stepTitle}>Your Trade</Text>
        <Text style={styles.stepSubtitle}>This personalises your demo data and templates</Text>
      </View>

      <View style={styles.tradeGrid}>
        {tradeTypes.map((trade) => (
          <TouchableOpacity
            key={trade.value}
            style={[styles.tradeOption, businessData.tradeType === trade.value && styles.tradeOptionSelected]}
            onPress={() => setBusinessData(prev => ({ ...prev, tradeType: trade.value }))}
            testID={`option-trade-${trade.value}`}
          >
            <Ionicons 
              name={trade.icon} 
              size={22} 
              color={businessData.tradeType === trade.value ? colors.primary : colors.mutedForeground} 
            />
            <Text style={[styles.tradeLabel, businessData.tradeType === trade.value && styles.tradeLabelSelected]}>{trade.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.primaryButton} onPress={() => {
          if (!businessData.tradeType) {
            Alert.alert('Required', 'Please select your trade type');
            return;
          }
          setOwnerStep('teamSize');
        }} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderOwnerTeamSize = () => (
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <View style={styles.stepHeader}>
        <View style={styles.iconCircle}>
          <Ionicons name="people" size={32} color={colors.primary} />
        </View>
        <Text style={styles.stepTitle}>Team Size</Text>
        <Text style={styles.stepSubtitle}>How many people work in your business?</Text>
      </View>

      <View style={styles.optionsGrid}>
        {teamSizes.map((size) => (
          <TouchableOpacity
            key={size.value}
            style={[styles.optionCard, businessData.teamSize === size.value && styles.optionCardSelected]}
            onPress={() => {
              setBusinessData(prev => ({ ...prev, teamSize: size.value }));
            }}
            testID={`option-team-${size.value}`}
          >
            <Ionicons 
              name={size.icon} 
              size={24} 
              color={businessData.teamSize === size.value ? colors.primary : colors.mutedForeground} 
            />
            <Text style={[styles.optionLabel, businessData.teamSize === size.value && styles.optionLabelSelected]}>{size.label}</Text>
            <Text style={styles.optionDescription}>{size.description}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.primaryButton, isLoading && { opacity: 0.5 }]} onPress={() => {
          if (!businessData.teamSize) {
            Alert.alert('Required', 'Please select your team size');
            return;
          }
          handleOwnerComplete();
        }} disabled={isLoading} activeOpacity={0.8}>
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Get Started</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );


  const renderWorkerInviteCode = () => (
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <View style={styles.stepHeader}>
        <View style={[styles.iconCircle, { backgroundColor: '#E8862E20' }]}>
          <Ionicons name="key" size={32} color="#E8862E" />
        </View>
        <Text style={styles.stepTitle}>Enter Invite Code</Text>
        <Text style={styles.stepSubtitle}>Your employer will have given you a 6-character code</Text>
      </View>

      <View style={styles.codeInputContainer}>
        <TextInput
          style={styles.codeInput}
          placeholder="e.g. MIKE42"
          placeholderTextColor={colors.mutedForeground}
          value={inviteCode}
          onChangeText={(text) => handleInviteCodeChange(text)}
          autoCapitalize="characters"
          maxLength={6}
          testID="input-invite-code"
        />
        {isValidatingCode && (
          <ActivityIndicator style={styles.codeSpinner} color={colors.primary} />
        )}
      </View>

      {inviteValidation?.valid && (
        <View style={styles.validationSuccess}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={styles.validationSuccessText}>
            You're joining <Text style={{ fontWeight: '700' }}>{inviteValidation.businessName}</Text> as a <Text style={{ fontWeight: '700', textTransform: 'capitalize' }}>{inviteValidation.roleType}</Text>
          </Text>
        </View>
      )}

      {inviteValidation && !inviteValidation.valid && (
        <View style={styles.validationError}>
          <Ionicons name="alert-circle" size={20} color={colors.destructive} />
          <Text style={styles.validationErrorText}>{inviteValidation.error}</Text>
        </View>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.primaryButton, (!inviteValidation?.valid) && { opacity: 0.5 }]}
          onPress={() => setWorkerStep('workerDetails')}
          disabled={!inviteValidation?.valid}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderWorkerDetails = () => (
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <View style={styles.stepHeader}>
        <View style={[styles.iconCircle, { backgroundColor: '#E8862E20' }]}>
          <Ionicons name="person" size={32} color="#E8862E" />
        </View>
        <Text style={styles.stepTitle}>Your Details</Text>
        <Text style={styles.stepSubtitle}>Quick info so your team knows who you are</Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>First Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="John"
          placeholderTextColor={colors.mutedForeground}
          value={workerName}
          onChangeText={setWorkerName}
          autoCapitalize="words"
          testID="input-worker-first-name"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Last Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Smith"
          placeholderTextColor={colors.mutedForeground}
          value={workerLastName}
          onChangeText={setWorkerLastName}
          autoCapitalize="words"
          testID="input-worker-last-name"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Phone (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="0412 345 678"
          placeholderTextColor={colors.mutedForeground}
          value={workerPhone}
          onChangeText={setWorkerPhone}
          keyboardType="phone-pad"
          testID="input-worker-phone"
        />
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.primaryButton, isLoading && { opacity: 0.5 }]}
          onPress={handleWorkerRedeem}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Join Team</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderSubDetails = () => (
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <View style={styles.stepHeader}>
        <View style={[styles.iconCircle, { backgroundColor: '#22c55e20' }]}>
          <Ionicons name="person" size={32} color="#22c55e" />
        </View>
        <Text style={styles.stepTitle}>Your Details</Text>
        <Text style={styles.stepSubtitle}>Tell us about yourself</Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>First Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="John"
          placeholderTextColor={colors.mutedForeground}
          value={subName}
          onChangeText={setSubName}
          autoCapitalize="words"
          testID="input-sub-first-name"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Last Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Smith"
          placeholderTextColor={colors.mutedForeground}
          value={subLastName}
          onChangeText={setSubLastName}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Phone</Text>
        <TextInput
          style={styles.input}
          placeholder="0412 345 678"
          placeholderTextColor={colors.mutedForeground}
          value={subPhone}
          onChangeText={setSubPhone}
          keyboardType="phone-pad"
        />
      </View>

      <Text style={styles.sectionLabel}>Trade Type</Text>
      <View style={styles.tradeGrid}>
        {tradeTypes.map((trade) => (
          <TouchableOpacity
            key={trade.value}
            style={[styles.tradeOption, subTradeType === trade.value && styles.tradeOptionSelected]}
            onPress={() => setSubTradeType(trade.value)}
          >
            <Ionicons 
              name={trade.icon} 
              size={18} 
              color={subTradeType === trade.value ? colors.primary : colors.mutedForeground} 
            />
            <Text style={[styles.tradeLabel, subTradeType === trade.value && styles.tradeLabelSelected]}>{trade.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>ABN (optional — for invoicing)</Text>
        <TextInput
          style={styles.input}
          placeholder="12 345 678 901"
          placeholderTextColor={colors.mutedForeground}
          value={formatABN(subAbn)}
          onChangeText={(text) => {
            const digits = text.replace(/\s/g, '').replace(/[^0-9]/g, '').slice(0, 11);
            setSubAbn(digits);
          }}
          keyboardType="number-pad"
          maxLength={14}
        />
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.primaryButton, isLoading && { opacity: 0.5 }]}
          onPress={handleSubDetailsNext}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Continue</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderSubConnect = () => (
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <View style={styles.stepHeader}>
        <View style={[styles.iconCircle, { backgroundColor: '#22c55e20' }]}>
          <Ionicons name="link" size={32} color="#22c55e" />
        </View>
        <Text style={styles.stepTitle}>Connect to a Business</Text>
        <Text style={styles.stepSubtitle}>Enter an invite code from a business you work with</Text>
      </View>

      <View style={styles.codeInputContainer}>
        <TextInput
          style={styles.codeInput}
          placeholder="e.g. MIKE42"
          placeholderTextColor={colors.mutedForeground}
          value={subInviteCode}
          onChangeText={(text) => handleInviteCodeChange(text, true)}
          autoCapitalize="characters"
          maxLength={6}
          testID="input-sub-invite-code"
        />
        {isValidatingSubCode && (
          <ActivityIndicator style={styles.codeSpinner} color={colors.primary} />
        )}
      </View>

      {subInviteValidation?.valid && (
        <View style={styles.validationSuccess}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={styles.validationSuccessText}>
            You'll be connected to <Text style={{ fontWeight: '700' }}>{subInviteValidation.businessName}</Text>
          </Text>
        </View>
      )}

      {subInviteValidation && !subInviteValidation.valid && (
        <View style={styles.validationError}>
          <Ionicons name="alert-circle" size={20} color={colors.destructive} />
          <Text style={styles.validationErrorText}>{subInviteValidation.error}</Text>
        </View>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.primaryButton, isLoading && { opacity: 0.5 }]}
          onPress={() => handleSubConnect(false)}
          disabled={isLoading || (!subInviteValidation?.valid && subInviteCode.length > 0)}
          activeOpacity={0.8}
        >
          {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Connect & Continue</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.skipButton} onPress={() => handleSubConnect(true)}>
        <Text style={styles.skipText}>Skip — I'll wait for an invite</Text>
        <Ionicons name="arrow-forward" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>
    </ScrollView>
  );

  const renderSubPrivacy = () => (
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <View style={styles.stepHeader}>
        <View style={[styles.iconCircle, { backgroundColor: '#22c55e20' }]}>
          <Ionicons name="shield-checkmark" size={32} color="#22c55e" />
        </View>
        <Text style={styles.stepTitle}>Your Privacy Matters</Text>
        <Text style={styles.stepSubtitle}>How location sharing works for subcontractors</Text>
      </View>

      <View style={styles.privacyCard}>
        <View style={styles.privacyItem}>
          <View style={[styles.privacyIcon, { backgroundColor: '#22c55e20' }]}>
            <Ionicons name="location" size={20} color="#22c55e" />
          </View>
          <View style={styles.privacyContent}>
            <Text style={styles.privacyTitle}>Active jobs only</Text>
            <Text style={styles.privacyText}>Your location is only shared when you're actively working on a job.</Text>
          </View>
        </View>

        <View style={styles.privacyItem}>
          <View style={[styles.privacyIcon, { backgroundColor: '#2563eb20' }]}>
            <Ionicons name="stop-circle" size={20} color="#2563eb" />
          </View>
          <View style={styles.privacyContent}>
            <Text style={styles.privacyTitle}>Tracking stops automatically</Text>
            <Text style={styles.privacyText}>The moment you complete a job, tracking stops. No exceptions.</Text>
          </View>
        </View>

        <View style={styles.privacyItem}>
          <View style={[styles.privacyIcon, { backgroundColor: '#8b5cf620' }]}>
            <Ionicons name="eye-off" size={20} color="#8b5cf6" />
          </View>
          <View style={styles.privacyContent}>
            <Text style={styles.privacyTitle}>Not tracked between jobs</Text>
            <Text style={styles.privacyText}>Businesses cannot see your location between jobs. Your personal time is private.</Text>
          </View>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleSubPrivacyAcknowledge} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>I Understand — Continue</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderComplete = () => {
    const isWorkerPath = selectedRole === 'worker';
    const isSubPath = selectedRole === 'subcontractor';

    return (
      <View style={[styles.stepContainer, styles.completeContainer]}>
        <View style={styles.completeContent}>
          <View style={styles.successBadge}>
            <View style={styles.successBadgeInner}>
              <Ionicons name="checkmark" size={36} color="#FFFFFF" />
            </View>
          </View>
          
          <Text style={styles.completeTitle}>
            {isWorkerPath ? 'Welcome to the team!' : isSubPath ? "You're all set!" : "You're good to go!"}
          </Text>
          <Text style={styles.completeSubtitle}>
            {isWorkerPath 
              ? `You've joined ${inviteValidation?.businessName || 'the team'}. Your assigned jobs will appear on your dashboard.`
              : isSubPath
                ? subInviteValidation?.valid 
                  ? `You're connected to ${subInviteValidation.businessName}. Jobs will appear when they're assigned to you.`
                  : 'Your account is ready. When a business assigns you jobs, they\'ll appear here.'
                : demoDataSeeded 
                  ? "We've loaded sample data so you can explore everything right away."
                  : "Your business is set up and ready to go."
            }
          </Text>

          {!isWorkerPath && !isSubPath && (
            <View style={styles.checkList}>
              <View style={styles.checkItem}>
                <View style={styles.checkDot} />
                <Text style={styles.checkText}>Business details configured</Text>
              </View>
              {demoDataSeeded && (
                <View style={styles.checkItem}>
                  <View style={styles.checkDot} />
                  <Text style={styles.checkText}>Sample data loaded</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.completeButtonWrap}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleComplete} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>
              {isWorkerPath ? 'View My Jobs' : isSubPath ? 'Get Started' : 'Start Using JobRunner'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const currentStep = getCurrentStep();
  const { current, total } = getStepCount();
  const progress = (current / total) * 100;

  if (isCheckingSettings) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingTextWhite, { color: colors.mutedForeground }]}>Setting up your account...</Text>
        </View>
      </View>
    );
  }

  const getStepLabel = () => {
    if (currentStep === 'role') return 'Get Started';
    if (selectedRole === 'owner') {
      const labels: Record<OwnerStep, string> = { role: 'Role', business: 'Business', trade: 'Trade', teamSize: 'Team Size', complete: 'Done!' };
      return labels[ownerStep];
    }
    if (selectedRole === 'worker') {
      const labels: Record<WorkerStep, string> = { role: 'Role', inviteCode: 'Invite Code', workerDetails: 'Details', complete: 'Done!' };
      return labels[workerStep];
    }
    const labels: Record<SubcontractorStep, string> = { role: 'Role', subDetails: 'Details', subConnect: 'Connect', privacy: 'Privacy', complete: 'Done!' };
    return labels[subStep];
  };

  const getStepColor = () => {
    if (!selectedRole || currentStep === 'role') return '#2563eb';
    if (selectedRole === 'owner') return '#2563eb';
    if (selectedRole === 'worker') return '#E8862E';
    return '#22c55e';
  };

  const canGoBack = () => {
    if (currentStep === 'role') return false;
    if (currentStep === 'complete') return false;
    return true;
  };

  const handleBack = () => {
    if (selectedRole === 'owner') {
      const steps: OwnerStep[] = ['role', 'business', 'trade', 'teamSize'];
      const idx = steps.indexOf(ownerStep);
      if (idx === 1) { setSelectedRole(null); setOwnerStep('role'); }
      else if (idx > 1) setOwnerStep(steps[idx - 1]);
    } else if (selectedRole === 'worker') {
      const steps: WorkerStep[] = ['role', 'inviteCode', 'workerDetails'];
      const idx = steps.indexOf(workerStep);
      if (idx === 1) { setSelectedRole(null); setWorkerStep('role'); }
      else if (idx > 1) setWorkerStep(steps[idx - 1]);
    } else if (selectedRole === 'subcontractor') {
      const steps: SubcontractorStep[] = ['role', 'subDetails', 'subConnect', 'privacy'];
      const idx = steps.indexOf(subStep);
      if (idx === 1) { setSelectedRole(null); setSubStep('role'); }
      else if (idx > 1) setSubStep(steps[idx - 1]);
    }
  };

  return (
    <View style={styles.gradientContainer}>
      <LinearGradient
        colors={['#1d4ed8', '#2563eb', '#3b82f6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 0 }}>
          <View style={styles.header}>
            <View style={styles.logoRow}>
              {canGoBack() && (
                <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                  <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              <View style={{ flex: 1 }} />
              {currentStep !== 'complete' && (
                <Text style={styles.stepIndicator}>Step {current} of {total}</Text>
              )}
            </View>

            {currentStep !== 'complete' && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBarWhite}>
                  <View style={[styles.progressFillWhite, { width: `${progress}%` }]} />
                </View>
              </View>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.contentCard}>
        {currentStep === 'role' && renderRoleSelection()}
        {selectedRole === 'owner' && ownerStep === 'business' && renderOwnerBusiness()}
        {selectedRole === 'owner' && ownerStep === 'trade' && renderOwnerTrade()}
        {selectedRole === 'owner' && ownerStep === 'teamSize' && renderOwnerTeamSize()}
        {selectedRole === 'worker' && workerStep === 'inviteCode' && renderWorkerInviteCode()}
        {selectedRole === 'worker' && workerStep === 'workerDetails' && renderWorkerDetails()}
        {selectedRole === 'subcontractor' && subStep === 'subDetails' && renderSubDetails()}
        {selectedRole === 'subcontractor' && subStep === 'subConnect' && renderSubConnect()}
        {selectedRole === 'subcontractor' && subStep === 'privacy' && renderSubPrivacy()}
        {currentStep === 'complete' && renderComplete()}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  gradientContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerGradient: {
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 40,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndicator: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingTextWhite: {
    fontSize: 16,
    fontWeight: '500',
  },
  progressContainer: {
    paddingTop: 12,
  },
  progressBarWhite: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFillWhite: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  contentCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -12,
    overflow: 'hidden',
  },
  stepContainer: {
    flex: 1,
  },
  stepContent: {
    padding: 24,
    paddingBottom: 40,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  stepSubtitle: {
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 22,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 14,
  },
  roleIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCardContent: {
    flex: 1,
  },
  roleCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  roleCardSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 12,
    marginTop: 8,
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
    letterSpacing: 0,
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
  buttonRow: {
    marginTop: 8,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    width: '100%',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  skipText: {
    fontSize: 14,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  codeInputContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  codeInput: {
    height: 64,
    paddingHorizontal: 20,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    color: colors.foreground,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
  },
  codeSpinner: {
    position: 'absolute',
    right: 16,
    top: 20,
  },
  validationSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '15',
    padding: 14,
    borderRadius: 10,
    gap: 10,
    marginBottom: 16,
  },
  validationSuccessText: {
    flex: 1,
    fontSize: 14,
    color: colors.success,
    lineHeight: 20,
  },
  validationError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.destructive + '15',
    padding: 14,
    borderRadius: 10,
    gap: 10,
    marginBottom: 16,
  },
  validationErrorText: {
    flex: 1,
    fontSize: 14,
    color: colors.destructive,
  },
  planCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: colors.cardBorder,
  },
  planCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.foreground,
  },
  planPeriod: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  planSeatPrice: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: 6,
    textAlign: 'right',
  },
  planDescription: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginBottom: 12,
  },
  planFeatures: {
    gap: 6,
  },
  planFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planFeatureText: {
    fontSize: 13,
    color: colors.foreground,
  },
  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '15',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    marginTop: 12,
  },
  trialBadgeText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  startFreeLink: {
    alignItems: 'center',
    padding: 8,
    marginBottom: 4,
  },
  startFreeLinkText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  privacyCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 20,
  },
  privacyItem: {
    flexDirection: 'row',
    gap: 14,
  },
  privacyIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  privacyContent: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  privacyText: {
    fontSize: 13,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  completeContainer: {
    justifyContent: 'space-between',
    padding: 24,
  },
  completeContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  successBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successBadgeInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  completeSubtitle: {
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  completeButtonWrap: {
    paddingBottom: 16,
  },
  checkList: {
    marginTop: 28,
    gap: 14,
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  checkText: {
    fontSize: 15,
    color: colors.foreground,
  },
});
