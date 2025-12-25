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
import api from '../../src/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../src/components/ui/Card';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius } from '../../src/lib/design-tokens';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const handleRequestReset = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.forgotPassword(email.trim());
      
      if (response.success) {
        setEmailSent(true);
      } else {
        Alert.alert('Error', response.error || 'Failed to send reset email');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send reset email. Please try again.');
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
            <Text style={styles.tagline}>Reset your password</Text>
          </View>

          <Card>
            <CardHeader>
              <CardTitle>{emailSent ? 'Check Your Email' : 'Forgot Password'}</CardTitle>
              <CardDescription>
                {emailSent 
                  ? `We've sent password reset instructions to ${email}`
                  : 'Enter your email address and we\'ll send you a link to reset your password.'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {emailSent ? (
                <View style={styles.successContainer}>
                  <View style={styles.successIcon}>
                    <Ionicons name="mail-outline" size={48} color={colors.primary} />
                  </View>
                  <Text style={styles.successText}>
                    If an account exists with this email, you'll receive password reset instructions shortly.
                  </Text>
                  <Text style={styles.tipText}>
                    Don't see the email? Check your spam folder.
                  </Text>
                  
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => {
                      setEmailSent(false);
                      setEmail('');
                    }}
                    testID="button-try-again"
                  >
                    <Text style={styles.primaryButtonText}>Try Another Email</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email Address</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your email"
                      placeholderTextColor={colors.mutedForeground}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoComplete="email"
                      testID="input-email"
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleRequestReset}
                    disabled={isLoading}
                    activeOpacity={0.8}
                    testID="button-send-reset"
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Send Reset Link</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </CardContent>
          </Card>

          <View style={styles.backContainer}>
            <TouchableOpacity 
              onPress={() => router.back()}
              style={styles.backButton}
              testID="button-back"
            >
              <Ionicons name="arrow-back" size={20} color={colors.primary} />
              <Text style={styles.backText}>Back to Sign In</Text>
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
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.foreground,
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
    backgroundColor: `${colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  successText: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  tipText: {
    fontSize: 13,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
    fontStyle: 'italic',
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
