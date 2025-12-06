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
import api from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { useTheme, ThemeColors } from '../../src/lib/theme';

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const login = useAuthStore((state) => state.login);
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
      router.replace('/(tabs)');
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
                source={require('../../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join TradieTrack today</Text>
          </View>

          <Card>
            <CardContent style={styles.cardContent}>
              <View style={styles.nameRow}>
                <View style={styles.nameField}>
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
                  />
                </View>
                <View style={styles.nameField}>
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
                  secureTextEntry
                  autoComplete="password-new"
                />
              </View>

              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Button
                variant="brand"
                size="xl"
                onPress={handleRegister}
                loading={isLoading}
                disabled={isLoading}
                fullWidth
              >
                Create Account
              </Button>
            </CardContent>
          </Card>

          <View style={styles.spacer} />

          <View style={styles.signInContainer}>
            <Text style={styles.signInText}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  subtitle: {
    fontSize: 16,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  cardContent: {
    paddingTop: 20,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 16,
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
  },
  signInLink: {
    color: colors.primary,
    fontWeight: '600',
  },
});
