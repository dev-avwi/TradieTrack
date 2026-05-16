import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../src/lib/theme';
import { spacing, radius } from '../../src/lib/design-tokens';
import { useScheduleSheetStore } from '../../src/lib/schedule-sheet-store';

export default function JobScheduleSheet() {
  const { colors, isDark } = useTheme();
  const { initialDate, onConfirm, reset } = useScheduleSheetStore();

  const [scheduleDate, setScheduleDate] = useState<Date>(initialDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    reset();
    if (router.canGoBack()) router.back();
  };

  const handleConfirm = async () => {
    if (!onConfirm || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(scheduleDate);
      close();
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ backgroundColor: colors.background, paddingBottom: spacing.lg }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
      }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground }}>Schedule Job</Text>
        <TouchableOpacity onPress={close} hitSlop={12}>
          <Feather name="x" size={24} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: spacing.lg }}>
        <Text style={{ fontSize: 14, color: colors.foreground, marginBottom: spacing.md }}>
          Select date and time for this job:
        </Text>

        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.background,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.md,
            marginBottom: spacing.md,
          }}
          onPress={() => { setShowDatePicker((v) => !v); setShowTimePicker(false); }}
        >
          <Feather name="calendar" size={20} color={colors.primary} style={{ marginRight: spacing.md }} />
          <Text style={{ color: colors.foreground, flex: 1, fontSize: 15 }}>
            {scheduleDate.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
          <Feather name={showDatePicker ? 'chevron-down' : 'chevron-right'} size={20} color={colors.mutedForeground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.background,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.md,
            marginBottom: spacing.lg,
          }}
          onPress={() => { setShowTimePicker((v) => !v); setShowDatePicker(false); }}
        >
          <Feather name="clock" size={20} color={colors.primary} style={{ marginRight: spacing.md }} />
          <Text style={{ color: colors.foreground, flex: 1, fontSize: 15 }}>
            {scheduleDate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Feather name={showTimePicker ? 'chevron-down' : 'chevron-right'} size={20} color={colors.mutedForeground} />
        </TouchableOpacity>

        {showDatePicker && (
          <View style={{ backgroundColor: colors.muted, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }}>
            <Text style={{ color: colors.foreground, fontWeight: '600', marginBottom: spacing.sm, textAlign: 'center' }}>Select Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 100 }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {Array.from({ length: 30 }, (_, i) => {
                  const date = new Date();
                  date.setDate(date.getDate() + i);
                  const isSelected = scheduleDate.toDateString() === date.toDateString();
                  return (
                    <TouchableOpacity
                      key={i}
                      onPress={() => {
                        const newDate = new Date(scheduleDate);
                        newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                        setScheduleDate(newDate);
                      }}
                      style={{
                        padding: spacing.md,
                        backgroundColor: isSelected ? colors.primary : colors.background,
                        borderRadius: radius.md,
                        minWidth: 70,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: isSelected ? colors.primaryForeground : colors.mutedForeground, fontSize: 12 }}>
                        {date.toLocaleDateString('en-AU', { weekday: 'short' })}
                      </Text>
                      <Text style={{ color: isSelected ? colors.primaryForeground : colors.foreground, fontSize: 18, fontWeight: '700' }}>
                        {date.getDate()}
                      </Text>
                      <Text style={{ color: isSelected ? colors.primaryForeground : colors.mutedForeground, fontSize: 12 }}>
                        {date.toLocaleDateString('en-AU', { month: 'short' })}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {showTimePicker && (
          <View style={{ marginBottom: spacing.md, alignItems: 'center' }}>
            <DateTimePicker
              value={scheduleDate}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minuteInterval={5}
              onChange={(_, selectedDate) => {
                if (Platform.OS !== 'ios') setShowTimePicker(false);
                if (selectedDate) setScheduleDate(selectedDate);
              }}
              themeVariant={isDark ? 'dark' : 'light'}
            />
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: colors.muted,
              borderRadius: radius.lg,
              paddingVertical: spacing.md,
              alignItems: 'center',
            }}
            onPress={close}
            disabled={submitting}
          >
            <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 15 }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: colors.primary,
              borderRadius: radius.lg,
              paddingVertical: spacing.md,
              alignItems: 'center',
              opacity: submitting ? 0.6 : 1,
            }}
            onPress={handleConfirm}
            disabled={submitting}
          >
            <Text style={{ color: colors.primaryForeground, fontWeight: '600', fontSize: 15 }}>
              {submitting ? 'Scheduling…' : 'Schedule Job'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
