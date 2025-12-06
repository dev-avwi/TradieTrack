import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../lib/colors';

interface TimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  label?: string;
  disabled?: boolean;
}

export function TimePicker({ value, onChange, label, disabled }: TimePickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [selectedHour, setSelectedHour] = useState(value.getHours());
  const [selectedMinute, setSelectedMinute] = useState(value.getMinutes());

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-AU', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 15, 30, 45];

  const handleConfirm = () => {
    const newDate = new Date(value);
    newDate.setHours(selectedHour, selectedMinute);
    onChange(newDate);
    setShowPicker(false);
  };

  return (
    <View>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[styles.timeButton, disabled && styles.disabledButton]}
        onPress={() => !disabled && setShowPicker(true)}
        disabled={disabled}
      >
        <Feather name="clock" size={20} color={disabled ? colors.mutedForeground : colors.primary} />
        <Text style={[styles.timeButtonText, disabled && styles.disabledText]}>
          {formatTime(value)}
        </Text>
      </TouchableOpacity>

      <Modal visible={showPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Time</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <View style={styles.timeColumns}>
              {/* Hour Column */}
              <View style={styles.column}>
                <Text style={styles.columnLabel}>Hour</Text>
                <ScrollView style={styles.scrollColumn} showsVerticalScrollIndicator={false}>
                  {hours.map((hour) => {
                    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                    const period = hour < 12 ? 'AM' : 'PM';
                    return (
                      <TouchableOpacity
                        key={hour}
                        style={[
                          styles.timeOption,
                          selectedHour === hour && styles.selectedOption,
                        ]}
                        onPress={() => setSelectedHour(hour)}
                      >
                        <Text
                          style={[
                            styles.timeOptionText,
                            selectedHour === hour && styles.selectedOptionText,
                          ]}
                        >
                          {displayHour} {period}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Minute Column */}
              <View style={styles.column}>
                <Text style={styles.columnLabel}>Minute</Text>
                <ScrollView style={styles.scrollColumn} showsVerticalScrollIndicator={false}>
                  {minutes.map((minute) => (
                    <TouchableOpacity
                      key={minute}
                      style={[
                        styles.timeOption,
                        selectedMinute === minute && styles.selectedOption,
                      ]}
                      onPress={() => setSelectedMinute(minute)}
                    >
                      <Text
                        style={[
                          styles.timeOptionText,
                          selectedMinute === minute && styles.selectedOptionText,
                        ]}
                      >
                        :{minute.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.preview}>
              <Text style={styles.previewLabel}>Selected:</Text>
              <Text style={styles.previewTime}>
                {selectedHour === 0 ? 12 : selectedHour > 12 ? selectedHour - 12 : selectedHour}:
                {selectedMinute.toString().padStart(2, '0')} {selectedHour < 12 ? 'AM' : 'PM'}
              </Text>
            </View>

            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: 8,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 12,
  },
  disabledButton: {
    opacity: 0.5,
  },
  timeButtonText: {
    fontSize: 16,
    color: colors.foreground,
  },
  disabledText: {
    color: colors.mutedForeground,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerContainer: {
    backgroundColor: colors.background,
    borderRadius: 16,
    width: '100%',
    maxWidth: 320,
    padding: 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  timeColumns: {
    flexDirection: 'row',
    gap: 16,
  },
  column: {
    flex: 1,
  },
  columnLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 8,
  },
  scrollColumn: {
    height: 200,
  },
  timeOption: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectedOption: {
    backgroundColor: colors.primary,
  },
  timeOptionText: {
    fontSize: 16,
    color: colors.foreground,
  },
  selectedOptionText: {
    color: colors.white,
    fontWeight: '600',
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  previewLabel: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  previewTime: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
});

export default TimePicker;
