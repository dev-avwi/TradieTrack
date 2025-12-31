import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import api from '../../src/lib/api';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company?: string;
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.foreground,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  smsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  smsBannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smsBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    height: 42,
    marginLeft: 10,
    fontSize: 15,
    color: colors.foreground,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clientAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  clientPhone: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  smsIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.foreground,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 8,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  noPhoneBadge: {
    fontSize: 11,
    color: colors.destructive,
    marginTop: 2,
  },
});

export default function NewSmsConversation() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const response = await api.get<Client[]>('/api/clients');
      if (response.data) {
        setClients(response.data);
      }
    } catch (error) {
      console.error('Failed to load clients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredClients = clients.filter(client => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
    return fullName.includes(term) || 
           client.phone?.toLowerCase().includes(term) ||
           client.company?.toLowerCase().includes(term);
  });

  const handleClientSelect = async (client: Client) => {
    if (!client.phone) {
      Alert.alert(
        'No Phone Number',
        `${client.firstName} ${client.lastName} doesn't have a phone number on file. Would you like to add one?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Edit Client', onPress: () => router.push(`/client/${client.id}` as any) }
        ]
      );
      return;
    }

    Alert.alert(
      'Start SMS Conversation',
      `Send SMS to ${client.firstName} ${client.lastName} at ${client.phone}?\n\nThis will send a real text message via Twilio. Standard SMS charges apply.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Send SMS', 
          onPress: async () => {
            try {
              const response = await api.post('/api/sms/conversations', {
                clientId: client.id,
                phoneNumber: client.phone,
                initialMessage: `Hi ${client.firstName}, this is a message from your tradie. How can I help you today?`
              });
              
              if (response.data) {
                Alert.alert('SMS Sent', `Started SMS conversation with ${client.firstName} ${client.lastName}`);
                router.back();
              } else {
                Alert.alert(
                  'Failed to Send SMS',
                  'Could not start SMS conversation. Please check your Twilio configuration or try again later.',
                  [{ text: 'OK' }]
                );
              }
            } catch (error: any) {
              console.error('Failed to create SMS conversation:', error);
              Alert.alert(
                'SMS Failed',
                error?.message || 'Failed to send SMS. Please check your Twilio settings and try again.',
                [{ text: 'OK' }]
              );
            }
          }
        }
      ]
    );
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  return (
    <>
      <Stack.Screen options={{ title: 'New SMS' }} />
      
      <View style={styles.container}>
        <View style={styles.headerCard}>
          <View style={styles.headerIconContainer}>
            <Feather name="edit-3" size={24} color={colors.primary} />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>New SMS Conversation</Text>
            <Text style={styles.headerSubtitle}>Select a client to message</Text>
          </View>
        </View>

        <View style={styles.smsBanner}>
          <View style={styles.smsBannerIcon}>
            <Feather name="alert-circle" size={14} color="#fff" />
          </View>
          <Text style={styles.smsBannerText}>
            SMS messages are sent via Twilio to the client's phone. Standard carrier rates may apply to the recipient.
          </Text>
        </View>

        <View style={styles.searchContainer}>
          <Feather name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search clients..."
            placeholderTextColor={colors.mutedForeground}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>

        <Text style={styles.sectionTitle}>
          {searchTerm ? 'SEARCH RESULTS' : 'CLIENTS'}
        </Text>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
          {isLoading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : filteredClients.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="users" size={28} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>
                {searchTerm ? 'No matching clients' : 'No clients yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchTerm ? 'Try a different search term' : 'Add clients to start sending SMS messages'}
              </Text>
            </View>
          ) : (
            filteredClients.map((client) => (
              <TouchableOpacity
                key={client.id}
                style={styles.clientCard}
                onPress={() => handleClientSelect(client)}
                activeOpacity={0.7}
              >
                <View style={styles.clientAvatar}>
                  <Text style={styles.clientAvatarText}>
                    {getInitials(client.firstName, client.lastName)}
                  </Text>
                </View>
                <View style={styles.clientInfo}>
                  <Text style={styles.clientName}>
                    {client.firstName} {client.lastName}
                  </Text>
                  {client.phone ? (
                    <Text style={styles.clientPhone}>{client.phone}</Text>
                  ) : (
                    <Text style={styles.noPhoneBadge}>No phone number</Text>
                  )}
                </View>
                <View style={styles.smsIcon}>
                  <Feather 
                    name="message-circle" 
                    size={18} 
                    color={client.phone ? colors.primary : colors.mutedForeground} 
                  />
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    </>
  );
}
