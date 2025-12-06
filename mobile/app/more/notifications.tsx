import { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch } from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.foreground,
  },
  settingSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 12,
  },
  infoText: {
    fontSize: 13,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [jobReminders, setJobReminders] = useState(true);
  const [paymentAlerts, setPaymentAlerts] = useState(true);
  const [quoteUpdates, setQuoteUpdates] = useState(true);

  return (
    <>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Notification Channels</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingIcon}>
                <Feather name="smartphone" size={20} color={colors.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Push Notifications</Text>
                <Text style={styles.settingSubtitle}>Receive alerts on your device</Text>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={setPushEnabled}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={pushEnabled ? colors.primary : colors.mutedForeground}
              />
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.settingRow}>
              <View style={styles.settingIcon}>
                <Feather name="mail" size={20} color={colors.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Email Notifications</Text>
                <Text style={styles.settingSubtitle}>Daily digest and important updates</Text>
              </View>
              <Switch
                value={emailEnabled}
                onValueChange={setEmailEnabled}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={emailEnabled ? colors.primary : colors.mutedForeground}
              />
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.settingRow}>
              <View style={styles.settingIcon}>
                <Feather name="message-square" size={20} color={colors.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>SMS Notifications</Text>
                <Text style={styles.settingSubtitle}>Urgent alerts via text message</Text>
              </View>
              <Switch
                value={smsEnabled}
                onValueChange={setSmsEnabled}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={smsEnabled ? colors.primary : colors.mutedForeground}
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Alert Types</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Job Reminders</Text>
                <Text style={styles.settingSubtitle}>Upcoming job notifications</Text>
              </View>
              <Switch
                value={jobReminders}
                onValueChange={setJobReminders}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={jobReminders ? colors.primary : colors.mutedForeground}
              />
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.settingRow}>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Payment Alerts</Text>
                <Text style={styles.settingSubtitle}>Payments received and overdue</Text>
              </View>
              <Switch
                value={paymentAlerts}
                onValueChange={setPaymentAlerts}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={paymentAlerts ? colors.primary : colors.mutedForeground}
              />
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.settingRow}>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Quote Updates</Text>
                <Text style={styles.settingSubtitle}>Quote accepted or rejected</Text>
              </View>
              <Switch
                value={quoteUpdates}
                onValueChange={setQuoteUpdates}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={quoteUpdates ? colors.primary : colors.mutedForeground}
              />
            </View>
          </View>

          <Text style={styles.infoText}>
            Push notifications require notification permissions. Please enable them in your device settings if they're not working.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}
