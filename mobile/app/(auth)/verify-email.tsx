import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle, XCircle, ArrowLeft } from 'lucide-react-native';
import api from '../../src/lib/api';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { useAuth } from '../../src/lib/auth';

export default function VerifyEmailScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { setUser, setSessionToken } = useAuth();

  useEffect(() => {
    if (token) {
      verifyEmail();
    } else {
      setVerifying(false);
      setError('No verification token provided');
    }
  }, [token]);

  const verifyEmail = async () => {
    try {
      setVerifying(true);
      setError(null);
      
      const response = await api.post('/api/auth/verify-email', { token });
      
      if (response.error) {
        setError(response.error || 'Verification failed');
        setSuccess(false);
      } else {
        setSuccess(true);
        
        if (response.user) {
          setUser(response.user);
        }
        if (response.sessionToken) {
          setSessionToken(response.sessionToken);
        }
        
        setTimeout(() => {
          if (response.isNewUser) {
            router.replace('/(main)/dashboard');
          } else {
            router.replace('/(main)/dashboard');
          }
        }, 2000);
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.message || 'An error occurred during verification');
      setSuccess(false);
    } finally {
      setVerifying(false);
    }
  };

  const handleBackToLogin = () => {
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {verifying ? (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.title}>Verifying your email...</Text>
            <Text style={styles.description}>
              Please wait while we verify your email address.
            </Text>
          </>
        ) : success ? (
          <>
            <View style={styles.iconContainer}>
              <CheckCircle size={64} color={colors.success} strokeWidth={1.5} />
            </View>
            <Text style={styles.title}>Email Verified!</Text>
            <Text style={styles.description}>
              Your email has been verified successfully. Redirecting you to the app...
            </Text>
          </>
        ) : (
          <>
            <View style={styles.iconContainer}>
              <XCircle size={64} color={colors.destructive} strokeWidth={1.5} />
            </View>
            <Text style={styles.title}>Verification Failed</Text>
            <Text style={styles.description}>
              {error || 'The verification link may have expired or is invalid.'}
            </Text>
            
            <TouchableOpacity
              style={styles.retryButton}
              onPress={verifyEmail}
              testID="button-retry-verification"
            >
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </>
        )}

        {!verifying && !success && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackToLogin}
            testID="button-back-to-login"
          >
            <ArrowLeft size={18} color={colors.foreground} />
            <Text style={styles.backText}>Back to sign in</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.foreground,
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 16,
  },
  retryText: {
    color: colors.primaryForeground,
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 24,
  },
  backText: {
    fontSize: 16,
    color: colors.foreground,
    marginLeft: 8,
  },
});
