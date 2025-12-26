import { useState } from 'react';
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
  Image,
  ActivityIndicator
} from 'react-native';
import { Link, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import api, { API_URL } from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { GoogleLogo } from '../../src/components/ui/GoogleLogo';
import { useTheme, ThemeColors } from '../../src/lib/theme';

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const login = useAuthStore((state) => state.login);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim() || !businessName.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    setError(null);

    const response = await api.register({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      password,
      businessName: businessName.trim(),
      tradeType: 'general',
    });

    setIsLoading(false);

    if (response.error) {
      setError(response.error);
      return;
    }

    const loginSuccess = await login(email.trim(), password);
    
    if (loginSuccess) {
      router.replace('/(onboarding)/setup');
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      
      // Add mobile flag so server redirects to app deep link
      const googleAuthUrl = `${API_URL}/api/auth/google?mobile=true`;
      
      const result = await WebBrowser.openAuthSessionAsync(
        googleAuthUrl,
        'tradietrack://',
        { showInRecents: true }
      );
      
      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const auth = url.searchParams.get('auth');
        const error = url.searchParams.get('error');
        const token = url.searchParams.get('token');
        
        if ((auth === 'success' || auth === 'google_success') && token) {
          // Save the session token from OAuth
          const api = (await import('../../src/lib/api')).default;
          await api.setToken(token);
          
          // Now check auth state from server with the token
          await checkAuth();
          router.replace('/(onboarding)/setup');
        } else if (auth === 'success' || auth === 'google_success') {
          // No token but auth success - try checkAuth anyway
          const isLoggedIn = await checkAuth();
          if (isLoggedIn) {
            router.replace('/(onboarding)/setup');
          } else {
            Alert.alert('Error', 'Failed to complete sign-up. Please try again.');
          }
        } else if (error) {
          Alert.alert('Error', 'Google sign-up failed. Please try again.');
        }
      }
    } catch (error) {
      console.error('Google Sign-Up error:', error);
      Alert.alert('Error', 'Failed to sign up with Google. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignUp = async () => {
    try {
      setAppleLoading(true);
      
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      
      if (credential.identityToken) {
        const response = await api.post<{ success: boolean; sessionToken: string; isNewUser: boolean }>('/api/auth/apple', {
          identityToken: credential.identityToken,
          fullName: credential.fullName,
          email: credential.email,
        });
        
        if (response.error) {
          Alert.alert('Error', response.error);
          return;
        }
        
        if (response.data?.sessionToken) {
          await api.setToken(response.data.sessionToken);
        }
        
        await checkAuth();
        router.replace('/(onboarding)/setup');
      }
    } catch (err: any) {
      if (err.code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      console.error('Apple Sign-Up error:', err);
      Alert.alert('Error', 'Failed to sign up with Apple. Please try again.');
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.logoGradientContainer}>
              <View style={styles.logoInner}>
                <Image 
                  source={require('../../assets/tradietrack-logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
            </View>
            <View style={styles.appNameContainer}>
              <Text style={styles.appNameBlue}>Tradie</Text>
              <Text style={styles.appNameOrange}>Track</Text>
            </View>
            <Text style={styles.title}>Start your free trial</Text>
            <Text style={styles.subtitle}>Join thousands of Australian tradies</Text>
          </View>

          <View style={styles.trialInfoCard}>
            <Text style={styles.trialInfoTitle}>Start with our Free plan</Text>
            <Text style={styles.trialInfoText}>
              Upgrade to Pro or Team to get a 14-day free trial
            </Text>
            <Text style={styles.trialInfoSubtext}>
              Card collected upfront, charged after trial ends
            </Text>
          </View>

          <Card>
            <CardContent style={styles.cardContent}>
              {/* Google Sign-Up Button First */}
              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleSignIn}
                disabled={googleLoading}
                testID="button-google-signup"
                activeOpacity={0.7}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color={colors.foreground} />
                ) : (
                  <>
                    <View style={styles.googleIconContainer}>
                      <GoogleLogo size={20} />
                    </View>
                    <Text style={styles.googleButtonText}>Sign up with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              {Platform.OS === 'ios' && (
                <View style={styles.appleButtonContainer}>
                  {appleLoading ? (
                    <View style={styles.appleLoadingContainer}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    </View>
                  ) : (
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                      cornerRadius={8}
                      style={styles.appleButton}
                      onPress={handleAppleSignUp}
                    />
                  )}
                </View>
              )}

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or sign up with email</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.nameRow}>
                <View style={[styles.nameField, { marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>First Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="John"
                    placeholderTextColor={colors.mutedForeground}
                    value={firstName}
                    onChangeText={(text) => {
                      setFirstName(text);
                      setError(null);
                    }}
                    autoCapitalize="words"
                    textContentType="givenName"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    enablesReturnKeyAutomatically={false}
                    testID="input-firstname"
                  />
                </View>
                <View style={[styles.nameField, { marginLeft: 8 }]}>
                  <Text style={styles.inputLabel}>Last Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Smith"
                    placeholderTextColor={colors.mutedForeground}
                    value={lastName}
                    onChangeText={(text) => {
                      setLastName(text);
                      setError(null);
                    }}
                    autoCapitalize="words"
                    textContentType="familyName"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    enablesReturnKeyAutomatically={false}
                    testID="input-lastname"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Business Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Smith Electrical"
                  placeholderTextColor={colors.mutedForeground}
                  value={businessName}
                  onChangeText={(text) => {
                    setBusinessName(text);
                    setError(null);
                  }}
                  autoCapitalize="words"
                  textContentType="organizationName"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  enablesReturnKeyAutomatically={false}
                  testID="input-business"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="john@smithelectrical.com.au"
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setError(null);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  enablesReturnKeyAutomatically={false}
                  testID="input-email"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="At least 6 characters"
                  placeholderTextColor={colors.mutedForeground}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError(null);
                  }}
                  secureTextEntry={true}
                  textContentType="oneTimeCode"
                  autoComplete="off"
                  autoCorrect={false}
                  autoCapitalize="none"
                  spellCheck={false}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  enablesReturnKeyAutomatically={false}
                  onSubmitEditing={handleRegister}
                  testID="input-password"
                />
              </View>

              <View style={styles.messageContainer}>
                {error ? (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}
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
                onPress={handleRegister}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Create Account</Text>
                )}
              </TouchableOpacity>
            </CardContent>
          </Card>

          <View style={styles.spacer} />

          <View style={styles.signInContainer}>
            <Text style={styles.signInText}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity testID="link-signin">
                <Text style={styles.signInLink}>Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoGradientContainer: {
    width: 72,
    height: 72,
    borderRadius: 18,
    padding: 2,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    backgroundColor: '#f97316',
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  logoInner: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 48,
    height: 48,
  },
  appNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  appNameBlue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  appNameOrange: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f97316',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.foreground,
  },
  subtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  cardContent: {
    paddingTop: 20,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 24,
    marginBottom: 4,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  googleIconText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  googleButtonText: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '500',
  },
  appleButtonContainer: {
    marginTop: 12,
    width: '100%',
  },
  appleButton: {
    width: '100%',
    height: 48,
  },
  appleLoadingContainer: {
    width: '100%',
    height: 48,
    backgroundColor: '#000000',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.cardBorder,
  },
  dividerText: {
    marginHorizontal: 12,
    color: colors.mutedForeground,
    fontSize: 13,
  },
  nameRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  nameField: {
    flex: 1,
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
    height: 52,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    color: colors.foreground,
    fontSize: 16,
  },
  messageContainer: {
    minHeight: 52,
    marginBottom: 16,
  },
  errorContainer: {
    padding: 12,
    backgroundColor: colors.destructiveLight,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.destructive,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    flex: 1,
    color: colors.destructive,
    fontSize: 14,
    fontWeight: '500',
  },
  spacer: {
    flex: 1,
    minHeight: 16,
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signInText: {
    color: colors.mutedForeground,
    fontSize: 15,
  },
  signInLink: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 15,
  },
  trialInfoCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  trialInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  trialInfoText: {
    fontSize: 14,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  trialInfoSubtext: {
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
