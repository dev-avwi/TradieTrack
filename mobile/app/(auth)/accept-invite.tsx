import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';

interface InviteDetails {
  valid: boolean;
  error?: string;
  invite?: {
    businessName: string;
    roleName: string;
    roleDescription?: string;
    email: string;
    inviterName: string;
    firstName?: string;
    lastName?: string;
    ownerId: string;
    teamMemberId: string;
  };
}

export default function AcceptInviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  
  const [inviteData, setInviteData] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const user = useAuthStore((state) => state.user);
  
  useEffect(() => {
    if (token) {
      validateInvite();
    }
  }, [token]);
  
  useEffect(() => {
    if (inviteData?.invite) {
      setEmail(inviteData.invite.email || '');
      setFirstName(inviteData.invite.firstName || '');
      setLastName(inviteData.invite.lastName || '');
    }
  }, [inviteData]);
  
  const validateInvite = async () => {
    try {
      setLoading(true);
      const response = await api.get<InviteDetails>(`/api/team/invite/validate/${token}`);
      if (response.data) {
        setInviteData(response.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to validate invite');
    } finally {
      setLoading(false);
    }
  };
  
  const acceptInvite = async () => {
    try {
      const response = await api.post<{ success: boolean; message?: string; error?: string }>(`/api/team/invite/accept/${token}`, {});
      if (response.data?.success) {
        await checkAuth();
        Alert.alert(
          'Welcome!',
          `You've joined ${inviteData?.invite?.businessName} as a ${inviteData?.invite?.roleName}.`,
          [{ text: 'Get Started', onPress: () => router.replace('/') }]
        );
      } else {
        throw new Error(response.data?.error || 'Failed to accept invite');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to accept invite');
    }
  };
  
  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      const response = await api.register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        businessName: inviteData?.invite?.businessName || 'My Business',
        inviteToken: token,
      });
      
      if (response.success) {
        await checkAuth();
        await acceptInvite();
      } else {
        setError(response.error || 'Registration failed');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      const response = await api.login({
        email: email.trim(),
        password,
      });
      
      if (response.success) {
        await checkAuth();
        await acceptInvite();
      } else {
        setError(response.error || 'Login failed');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Validating invitation...</Text>
        </View>
      </>
    );
  }
  
  if (!inviteData?.valid || !inviteData?.invite) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={styles.errorCard}>
            <Feather name="alert-circle" size={48} color={colors.destructive} />
            <Text style={styles.errorTitle}>Invalid Invitation</Text>
            <Text style={styles.errorText}>
              {inviteData?.error || 'This invitation link is invalid or has expired.'}
            </Text>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text style={styles.backButtonText}>Go to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }
  
  const invite = inviteData.invite;
  
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.inviteHeader}>
            <View style={styles.iconContainer}>
              <Feather name="users" size={32} color={colors.primary} />
            </View>
            <Text style={styles.title}>You're Invited!</Text>
            <Text style={styles.subtitle}>
              <Text style={styles.inviterName}>{invite.inviterName}</Text> has invited you to join
            </Text>
          </View>
          
          <View style={styles.businessCard}>
            <View style={styles.businessIcon}>
              <Feather name="briefcase" size={24} color={colors.primary} />
            </View>
            <View style={styles.businessInfo}>
              <Text style={styles.businessName}>{invite.businessName}</Text>
              <View style={styles.roleBadge}>
                <Feather name="shield" size={12} color={colors.success} />
                <Text style={styles.roleText}>{invite.roleName}</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.modeSelector}>
            <TouchableOpacity 
              style={[styles.modeButton, mode === 'register' && styles.modeButtonActive]}
              onPress={() => setMode('register')}
            >
              <Text style={[styles.modeButtonText, mode === 'register' && styles.modeButtonTextActive]}>
                Create Account
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modeButton, mode === 'login' && styles.modeButtonActive]}
              onPress={() => setMode('login')}
            >
              <Text style={[styles.modeButtonText, mode === 'login' && styles.modeButtonTextActive]}>
                I Have an Account
              </Text>
            </TouchableOpacity>
          </View>
          
          {error && (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={16} color={colors.destructive} />
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}
          
          <View style={styles.form}>
            {mode === 'register' && (
              <>
                <View style={styles.inputRow}>
                  <View style={styles.inputHalf}>
                    <Text style={styles.label}>First Name</Text>
                    <TextInput
                      style={styles.input}
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="John"
                      placeholderTextColor={colors.mutedForeground}
                      autoCapitalize="words"
                    />
                  </View>
                  <View style={styles.inputHalf}>
                    <Text style={styles.label}>Last Name</Text>
                    <TextInput
                      style={styles.input}
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="Smith"
                      placeholderTextColor={colors.mutedForeground}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
              </>
            )}
            
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, mode === 'register' && styles.inputDisabled]}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={mode === 'login'}
            />
            {mode === 'register' && (
              <Text style={styles.emailNote}>Email is pre-filled from your invitation</Text>
            )}
            
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={mode === 'register' ? 'Create a password' : 'Enter your password'}
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
            />
            
            <TouchableOpacity 
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={mode === 'register' ? handleRegister : handleLogin}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>
                    {mode === 'register' ? 'Create Account & Join' : 'Login & Join'}
                  </Text>
                  <Feather name="arrow-right" size={18} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.mutedForeground,
  },
  errorCard: {
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  inviteHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  inviterName: {
    fontWeight: '600',
    color: colors.foreground,
  },
  businessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  businessIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  roleText: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '500',
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeButtonActive: {
    backgroundColor: colors.card,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  modeButtonTextActive: {
    color: colors.foreground,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.destructive + '15',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    color: colors.destructive,
  },
  form: {
    gap: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputHalf: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.foreground,
  },
  inputDisabled: {
    backgroundColor: colors.muted,
    color: colors.mutedForeground,
  },
  emailNote: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: -4,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
