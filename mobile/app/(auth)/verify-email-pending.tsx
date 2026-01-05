import { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Mail, RefreshCw, ArrowLeft, CheckCircle } from 'lucide-react-native';
import api from '../../src/lib/api';
import { useTheme, ThemeColors } from '../../src/lib/theme';

export default function VerifyEmailPendingScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const handleResendEmail = async () => {
    if (!email || resending) return;
    
    setResending(true);
    setResendSuccess(false);
    
    try {
      const response = await api.post('/api/auth/resend-verification', { email });
      if (!response.error) {
        setResendSuccess(true);
        setTimeout(() => setResendSuccess(false), 5000);
      }
    } catch (error) {
      console.error('Failed to resend verification email:', error);
    } finally {
      setResending(false);
    }
  };

  const handleBackToLogin = () => {
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Mail size={64} color={colors.primary} strokeWidth={1.5} />
        </View>
        
        <Text style={styles.title}>Check your email</Text>
        
        <Text style={styles.description}>
          We've sent a verification link to
        </Text>
        
        <Text style={styles.email}>{email || 'your email address'}</Text>
        
        <Text style={styles.instructions}>
          Click the link in the email to verify your account, then return here to sign in.
        </Text>

        {resendSuccess && (
          <View style={styles.successMessage}>
            <CheckCircle size={18} color={colors.success} />
            <Text style={styles.successText}>Verification email sent!</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResendEmail}
          disabled={resending}
          testID="button-resend-verification"
        >
          {resending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <RefreshCw size={18} color={colors.primary} />
              <Text style={styles.resendText}>Resend verification email</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackToLogin}
          testID="button-back-to-login"
        >
          <ArrowLeft size={18} color={colors.foreground} />
          <Text style={styles.backText}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primaryLight || colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: 16,
  },
  instructions: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.successLight || colors.background,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.success,
  },
  successText: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '500',
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: 16,
  },
  resendText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  backText: {
    fontSize: 16,
    color: colors.foreground,
  },
});
