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
import { router, useLocalSearchParams } from 'expo-router';
import api from '../../src/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../src/components/ui/Card';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius } from '../../src/lib/design-tokens';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const { colors } = useTheme();
  const styles = createStyles(colors);

  useEffect(() => {
    if (params.token) {
      setToken(params.token as string);
    }
  }, [params.token]);

  const getPasswordRequirements = (pwd: string) => {
    return [
      { label: 'At least 8 characters', met: pwd.length >= 8 },
      { label: 'Contains a number', met: /\d/.test(pwd) },
      { label: 'Contains uppercase letter', met: /[A-Z]/.test(pwd) },
      { label: 'Contains lowercase letter', met: /[a-z]/.test(pwd) },
    ];
  };

  const passwordRequirements = getPasswordRequirements(password);
  const allRequirementsMet = passwordRequirements.every(r => r.met);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (!allRequirementsMet) {
      Alert.alert('Error', 'Please meet all password requirements');
      return;
    }

    if (!token) {
      Alert.alert('Error', 'Reset token is missing. Please use the link from your email.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.resetPassword(token, password);
      
      if (response.success) {
        setResetSuccess(true);
      } else {
        Alert.alert('Error', response.error || 'Failed to reset password');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
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
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../assets/tradietrack-logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appName}>TradieTrack</Text>
            <Text style={styles.tagline}>
              {resetSuccess ? 'Password Reset!' : 'Create New Password'}
            </Text>
          </View>

          <Card>
            <CardHeader>
              <CardTitle>
                {resetSuccess ? 'Success!' : 'Reset Password'}
              </CardTitle>
              <CardDescription>
                {resetSuccess 
                  ? 'Your password has been successfully reset. You can now sign in with your new password.'
                  : 'Enter your new password below.'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resetSuccess ? (
                <View style={styles.successContainer}>
                  <View style={styles.successIcon}>
                    <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
                  </View>
                  
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => router.replace('/(auth)/login')}
                    testID="button-go-to-login"
                  >
                    <Text style={styles.primaryButtonText}>Go to Sign In</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>New Password</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        placeholder="Enter new password"
                        placeholderTextColor={colors.mutedForeground}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoComplete="new-password"
                        testID="input-password"
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={styles.eyeButton}
                      >
                        <Ionicons 
                          name={showPassword ? "eye-off-outline" : "eye-outline"} 
                          size={20} 
                          color={colors.mutedForeground} 
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {password.length > 0 && (
                    <View style={styles.requirementsContainer}>
                      {passwordRequirements.map((req, index) => (
                        <View key={index} style={styles.requirementRow}>
                          <Ionicons 
                            name={req.met ? "checkmark-circle" : "close-circle"} 
                            size={16} 
                            color={req.met ? "#22c55e" : colors.mutedForeground} 
                          />
                          <Text style={[
                            styles.requirementText,
                            req.met && styles.requirementMet
                          ]}>
                            {req.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Confirm Password</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        placeholder="Confirm new password"
                        placeholderTextColor={colors.mutedForeground}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showConfirmPassword}
                        autoComplete="new-password"
                        testID="input-confirm-password"
                      />
                      <TouchableOpacity
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={styles.eyeButton}
                      >
                        <Ionicons 
                          name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                          size={20} 
                          color={colors.mutedForeground} 
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {confirmPassword.length > 0 && (
                    <View style={styles.matchIndicator}>
                      <Ionicons 
                        name={passwordsMatch ? "checkmark-circle" : "close-circle"} 
                        size={16} 
                        color={passwordsMatch ? "#22c55e" : "#ef4444"} 
                      />
                      <Text style={[
                        styles.matchText,
                        passwordsMatch ? styles.matchSuccess : styles.matchError
                      ]}>
                        {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      (!allRequirementsMet || !passwordsMatch) && styles.primaryButtonDisabled
                    ]}
                    onPress={handleResetPassword}
                    disabled={isLoading || !allRequirementsMet || !passwordsMatch}
                    activeOpacity={0.8}
                    testID="button-reset-password"
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Reset Password</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </CardContent>
          </Card>

          {!resetSuccess && (
            <View style={styles.backContainer}>
              <TouchableOpacity 
                onPress={() => router.replace('/(auth)/login')}
                style={styles.backButton}
                testID="button-back"
              >
                <Ionicons name="arrow-back" size={20} color={colors.primary} />
                <Text style={styles.backText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
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
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logo: {
    width: 60,
    height: 60,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  tagline: {
    fontSize: 16,
    color: colors.mutedForeground,
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.foreground,
  },
  eyeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  requirementsContainer: {
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  requirementText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  requirementMet: {
    color: '#22c55e',
  },
  matchIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  matchText: {
    fontSize: 13,
  },
  matchSuccess: {
    color: '#22c55e',
  },
  matchError: {
    color: '#ef4444',
  },
  primaryButton: {
    backgroundColor: '#1e3a5f',
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: spacing.sm,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#22c55e20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  backContainer: {
    alignItems: 'center',
    marginTop: spacing['2xl'],
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
});
