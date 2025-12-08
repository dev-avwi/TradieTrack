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
  ActivityIndicator
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import api from '../../src/lib/api';

type Step = 'email' | 'code' | 'newPassword' | 'success';

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState('');
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const handleRequestReset = async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/auth/forgot-password', { email: email.trim() });
      
      if (response.error) {
        setError(response.error);
        return;
      }

      setStep('code');
      Alert.alert(
        'Check Your Email',
        'We\'ve sent a password reset code to your email address. Please check your inbox.',
        [{ text: 'OK' }]
      );
    } catch (err) {
      setError('Failed to send reset code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code.trim() || code.length < 6) {
      setError('Please enter the 6-digit code from your email');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{ valid: boolean; token: string }>('/api/auth/verify-reset-code', { 
        email: email.trim(), 
        code: code.trim() 
      });
      
      if (response.error || !response.data?.valid) {
        setError('Invalid or expired code. Please try again.');
        return;
      }

      setResetToken(response.data.token);
      setStep('newPassword');
    } catch (err) {
      setError('Failed to verify code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim() || newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/auth/reset-password', { 
        token: resetToken,
        newPassword: newPassword.trim()
      });
      
      if (response.error) {
        setError(response.error);
        return;
      }

      setStep('success');
    } catch (err) {
      setError('Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderEmailStep = () => (
    <>
      <CardHeader>
        <CardTitle>Reset Password</CardTitle>
        <CardDescription>
          Enter your email address and we'll send you a code to reset your password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError(null);
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Button 
          variant="brand"
          onPress={handleRequestReset}
          loading={isLoading}
          fullWidth
          size="xl"
        >
          Send Reset Code
        </Button>
      </CardContent>
    </>
  );

  const renderCodeStep = () => (
    <>
      <CardHeader>
        <CardTitle>Enter Code</CardTitle>
        <CardDescription>
          We've sent a 6-digit code to {email}. Enter it below to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Verification Code</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="000000"
            placeholderTextColor={colors.mutedForeground}
            value={code}
            onChangeText={(text) => {
              setCode(text.replace(/[^0-9]/g, '').slice(0, 6));
              setError(null);
            }}
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
          />
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Button 
          variant="brand"
          onPress={handleVerifyCode}
          loading={isLoading}
          fullWidth
          size="xl"
        >
          Verify Code
        </Button>

        <TouchableOpacity 
          style={styles.resendButton}
          onPress={handleRequestReset}
          disabled={isLoading}
        >
          <Text style={styles.resendText}>Didn't receive the code? Resend</Text>
        </TouchableOpacity>
      </CardContent>
    </>
  );

  const renderNewPasswordStep = () => (
    <>
      <CardHeader>
        <CardTitle>Create New Password</CardTitle>
        <CardDescription>
          Enter your new password below. Make sure it's at least 8 characters.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>New Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter new password"
            placeholderTextColor={colors.mutedForeground}
            value={newPassword}
            onChangeText={(text) => {
              setNewPassword(text);
              setError(null);
            }}
            secureTextEntry
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Confirm new password"
            placeholderTextColor={colors.mutedForeground}
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setError(null);
            }}
            secureTextEntry
          />
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Button 
          variant="brand"
          onPress={handleResetPassword}
          loading={isLoading}
          fullWidth
          size="xl"
        >
          Reset Password
        </Button>
      </CardContent>
    </>
  );

  const renderSuccessStep = () => (
    <>
      <CardHeader>
        <View style={styles.successIcon}>
          <Feather name="check-circle" size={48} color={colors.success} />
        </View>
        <CardTitle style={{ textAlign: 'center' }}>Password Reset!</CardTitle>
        <CardDescription style={{ textAlign: 'center' }}>
          Your password has been successfully reset. You can now sign in with your new password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          variant="brand"
          onPress={() => router.replace('/(auth)/login')}
          fullWidth
          size="xl"
        >
          Back to Sign In
        </Button>
      </CardContent>
    </>
  );

  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: true,
          headerTitle: '',
          headerTransparent: true,
          headerBackTitle: 'Back',
          headerTintColor: colors.primary,
        }}
      />
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
              <View style={styles.iconContainer}>
                <Feather 
                  name={step === 'success' ? 'check-circle' : 'lock'} 
                  size={32} 
                  color={colors.primary} 
                />
              </View>
            </View>

            <Card>
              {step === 'email' && renderEmailStep()}
              {step === 'code' && renderCodeStep()}
              {step === 'newPassword' && renderNewPasswordStep()}
              {step === 'success' && renderSuccessStep()}
            </Card>

            {step !== 'success' && (
              <TouchableOpacity 
                style={styles.backToLogin}
                onPress={() => router.back()}
              >
                <Text style={styles.backToLoginText}>Back to Sign In</Text>
              </TouchableOpacity>
            )}
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
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    color: colors.foreground,
    fontSize: 16,
  },
  codeInput: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 8,
  },
  errorContainer: {
    padding: 12,
    backgroundColor: colors.destructiveLight,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: colors.destructive,
    fontSize: 14,
  },
  resendButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  resendText: {
    color: colors.primary,
    fontSize: 14,
  },
  successIcon: {
    alignItems: 'center',
    marginBottom: 16,
  },
  backToLogin: {
    alignItems: 'center',
    marginTop: 24,
  },
  backToLoginText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
});
