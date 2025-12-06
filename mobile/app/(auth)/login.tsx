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
  Image
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuthStore } from '../../src/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { useTheme, ThemeColors } from '../../src/lib/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuthStore();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    const success = await login(email.trim(), password);
    
    if (success) {
      router.replace('/(tabs)');
    }
  };

  const fillTestAccount = () => {
    setEmail('luke@harriselectrical.com.au');
    setPassword('Test123!');
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
                source={require('../../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appName}>TradieTrack</Text>
            <Text style={styles.tagline}>Welcome back, mate!</Text>
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
                />
              </View>

              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Button 
                variant="brand"
                onPress={handleLogin}
                loading={isLoading}
                fullWidth
                size="xl"
              >
                Sign In
              </Button>

              <TouchableOpacity 
                style={styles.forgotPassword}
                onPress={() => Alert.alert('Forgot Password', 'Password reset functionality coming soon!')}
              >
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </TouchableOpacity>
            </CardContent>
          </Card>

          <View style={styles.spacer} />

          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Don't have an account? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={styles.signUpLink}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>

          <TouchableOpacity 
            onPress={fillTestAccount}
            style={styles.testAccountButton}
          >
            <Text style={styles.testAccountText}>
              Tap to use test account: luke@harriselectrical.com.au
            </Text>
          </TouchableOpacity>
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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  logo: {
    width: 60,
    height: 60,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 16,
    color: colors.mutedForeground,
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
  forgotPassword: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotPasswordText: {
    color: colors.primary,
    fontSize: 14,
  },
  spacer: {
    flex: 1,
    minHeight: 24,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signUpText: {
    color: colors.mutedForeground,
  },
  signUpLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  testAccountButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  testAccountText: {
    textAlign: 'center',
    color: colors.mutedForeground,
    fontSize: 12,
  },
});
