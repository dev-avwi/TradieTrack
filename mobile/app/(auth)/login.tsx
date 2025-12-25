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
  Image,
  ActivityIndicator
} from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuthStore } from '../../src/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { GoogleLogo } from '../../src/components/ui/GoogleLogo';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import api, { API_URL } from '../../src/lib/api';
import { spacing, radius } from '../../src/lib/design-tokens';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const { login, checkAuth, isLoading, error, clearError, isAuthenticated, user } = useAuthStore();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const params = useLocalSearchParams();

  // Helper function to determine redirect path based on user type
  const getRedirectPath = (isNewUser: boolean, isPlatformAdmin: boolean): string => {
    // Platform admins go directly to admin dashboard
    if (isPlatformAdmin) {
      return '/more/admin';
    }
    // New users go to onboarding, existing users go to dashboard
    return isNewUser ? '/(onboarding)/setup' : '/(tabs)';
  };

  // Handle Google OAuth callback via deep link
  useEffect(() => {
    if (params.auth === 'google_success' || params.auth === 'success') {
      // Check if this is a new user who needs onboarding
      const isNewUser = params.isNewUser === 'true';
      
      // Refresh auth state after Google login, then check store state
      checkAuth().then(() => {
        // Get the current state after checkAuth completes
        const { isAuthenticated: loggedIn, user: currentUser } = useAuthStore.getState();
        if (loggedIn) {
          const isPlatformAdmin = currentUser?.isPlatformAdmin === true;
          const redirectPath = getRedirectPath(isNewUser, isPlatformAdmin);
          router.replace(redirectPath);
        }
      });
    }
  }, [params.auth, params.isNewUser]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    const success = await login(email.trim(), password);
    
    if (success) {
      // Check if user is platform admin after successful login
      const { user: currentUser } = useAuthStore.getState();
      const isPlatformAdmin = currentUser?.isPlatformAdmin === true;
      const redirectPath = getRedirectPath(false, isPlatformAdmin);
      router.replace(redirectPath);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      
      // Open Google OAuth in system browser with mobile flag
      // The backend will detect this and redirect back to the app deep link
      const googleAuthUrl = `${API_URL}/api/auth/google?mobile=true`;
      
      const result = await WebBrowser.openAuthSessionAsync(
        googleAuthUrl,
        'tradietrack://',
        { showInRecents: true }
      );
      
      if (result.type === 'success' && result.url) {
        // Parse the callback URL for auth status
        const url = new URL(result.url);
        const auth = url.searchParams.get('auth');
        const errorParam = url.searchParams.get('error');
        const token = url.searchParams.get('token');
        const isNewUser = url.searchParams.get('isNewUser') === 'true';
        
        if ((auth === 'success' || auth === 'google_success') && token) {
          // Save the session token from OAuth
          const api = (await import('../../src/lib/api')).default;
          await api.setToken(token);
          
          // Now check auth state from server with the token
          await checkAuth();
          
          // Determine redirect based on user type
          const { user: currentUser } = useAuthStore.getState();
          const isPlatformAdmin = currentUser?.isPlatformAdmin === true;
          const redirectPath = getRedirectPath(isNewUser, isPlatformAdmin);
          router.replace(redirectPath);
        } else if (auth === 'success' || auth === 'google_success') {
          // No token but auth success - try checkAuth anyway
          await checkAuth();
          const { isAuthenticated: loggedIn, user: currentUser } = useAuthStore.getState();
          if (loggedIn) {
            const isPlatformAdmin = currentUser?.isPlatformAdmin === true;
            const redirectPath = getRedirectPath(isNewUser, isPlatformAdmin);
            router.replace(redirectPath);
          } else {
            Alert.alert('Error', 'Failed to complete sign-in. Please try again.');
          }
        } else if (errorParam) {
          Alert.alert('Error', 'Google sign-in failed. Please try again.');
        }
      }
    } catch (err) {
      console.error('Google Sign-In error:', err);
      Alert.alert('Error', 'Failed to sign in with Google. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
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
        
        const { user: currentUser } = useAuthStore.getState();
        const isPlatformAdmin = currentUser?.isPlatformAdmin === true;
        const isNewUser = response.data?.isNewUser === true;
        const redirectPath = getRedirectPath(isNewUser, isPlatformAdmin);
        router.replace(redirectPath);
      }
    } catch (err: any) {
      if (err.code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      console.error('Apple Sign-In error:', err);
      Alert.alert('Error', 'Failed to sign in with Apple. Please try again.');
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
            <Text style={styles.tagline}>Welcome back!</Text>
            <Text style={styles.taglineSubtext}>Sign in to manage your trade business</Text>
          </View>

          <Card>
            <CardHeader>
              <CardTitle>Sign In</CardTitle>
              <CardDescription>Enter your email and password to continue</CardDescription>
            </CardHeader>
            <CardContent>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    clearError();
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  testID="input-email"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.mutedForeground}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    clearError();
                  }}
                  secureTextEntry
                  autoComplete="password"
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
                  paddingHorizontal: spacing.xl,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                }}
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Sign In</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.forgotPassword}
                onPress={() => router.push('/(auth)/forgot-password')}
                testID="link-forgot-password"
              >
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleSignIn}
                disabled={googleLoading}
                testID="button-google-signin"
                activeOpacity={0.7}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color={colors.foreground} />
                ) : (
                  <>
                    <View style={styles.googleIconContainer}>
                      <GoogleLogo size={20} />
                    </View>
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
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
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                      cornerRadius={radius.sm}
                      style={styles.appleButton}
                      onPress={handleAppleSignIn}
                    />
                  )}
                </View>
              )}
            </CardContent>
          </Card>

          <View style={styles.spacer} />

          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Don't have an account? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity testID="link-signup">
                <Text style={styles.signUpLink}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>

          <View style={styles.demoAccountCard}>
            <Text style={styles.demoAccountLabel}>Demo Account</Text>
            <Text style={styles.demoAccountText}>demo@tradietrack.com.au</Text>
            <Text style={styles.demoAccountText}>demo123456</Text>
            <TouchableOpacity 
              style={styles.demoLoginButton}
              onPress={() => {
                setEmail('demo@tradietrack.com.au');
                setPassword('demo123456');
              }}
              testID="button-fill-demo"
            >
              <Text style={styles.demoLoginButtonText}>Use Demo Account</Text>
            </TouchableOpacity>
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
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing['2xl'],
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing['3xl'],
  },
  logoGradientContainer: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    padding: 2,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: radius.md,
    elevation: 8,
    backgroundColor: '#f97316',
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  logoInner: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
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
    marginBottom: spacing.sm,
  },
  appNameBlue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  appNameOrange: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f97316',
  },
  tagline: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  taglineSubtext: {
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: 'center',
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
    height: 52,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    color: colors.foreground,
    fontSize: 16,
  },
  messageContainer: {
    minHeight: 52,
    marginBottom: spacing.lg,
  },
  errorContainer: {
    padding: spacing.md,
    backgroundColor: colors.destructiveLight,
    borderRadius: radius.md,
    borderLeftWidth: spacing.xs,
    borderLeftColor: colors.destructive,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  errorText: {
    flex: 1,
    color: colors.destructive,
    fontSize: 14,
    fontWeight: '500',
  },
  successContainer: {
    padding: spacing.md,
    backgroundColor: colors.successLight,
    borderRadius: radius.md,
    borderLeftWidth: spacing.xs,
    borderLeftColor: colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  successText: {
    flex: 1,
    color: colors.success,
    fontSize: 14,
    fontWeight: '500',
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  forgotPasswordText: {
    color: colors.primary,
    fontSize: 15,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.cardBorder,
  },
  dividerText: {
    marginHorizontal: spacing.lg,
    color: colors.mutedForeground,
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    height: 56,
    paddingHorizontal: spacing['2xl'],
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: radius.md,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
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
    marginTop: spacing.md,
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
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    height: spacing.lg,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing['2xl'],
  },
  signUpText: {
    color: colors.mutedForeground,
    fontSize: 15,
  },
  signUpLink: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 15,
  },
  demoAccountCard: {
    marginTop: spacing['2xl'],
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
  },
  demoAccountLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  demoAccountText: {
    fontSize: 14,
    color: colors.foreground,
    fontFamily: 'monospace',
    marginBottom: spacing.xs,
  },
  demoLoginButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary + '15',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  demoLoginButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});
