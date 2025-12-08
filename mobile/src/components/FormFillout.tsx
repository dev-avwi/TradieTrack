import { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  StyleSheet,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path } from 'react-native-svg';
import { useTheme, ThemeColors } from '../lib/theme';
import { spacing, radius, shadows, typography } from '../lib/design-tokens';
import { Button } from './ui/Button';

interface FormField {
  id: string;
  type: 'text' | 'number' | 'checkbox' | 'select' | 'textarea' | 'signature' | 'photo' | 'date' | 'time';
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

interface FormTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  fields: FormField[];
}

interface FormFilloutProps {
  template: FormTemplate;
  onSubmit: (responses: Record<string, any>, photos: string[]) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

interface SignaturePoint {
  x: number;
  y: number;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    padding: spacing.xs,
  },
  submitButton: {
    padding: spacing.xs,
  },
  submitButtonText: {
    ...typography.label,
    color: colors.primary,
  },
  submitButtonDisabled: {
    color: colors.mutedForeground,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  fieldContainer: {
    marginBottom: spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.foreground,
    flex: 1,
  },
  required: {
    color: colors.destructive,
    marginLeft: spacing.xs,
  },
  textInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.foreground,
    ...typography.body,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    ...typography.body,
    color: colors.foreground,
    flex: 1,
  },
  selectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  selectOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectOptionSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  selectOptionText: {
    ...typography.body,
    color: colors.foreground,
  },
  selectOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  photoContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  photoButton: {
    width: 100,
    height: 100,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  photoPreview: {
    width: 100,
    height: 100,
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.destructive,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signatureContainer: {
    marginTop: spacing.sm,
  },
  signatureCanvas: {
    height: 150,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  signatureCanvasPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signatureCanvasPlaceholderText: {
    ...typography.body,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  signatureButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  clearButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderRadius: radius.md,
  },
  clearButtonText: {
    ...typography.label,
    color: colors.foreground,
  },
  signaturePreview: {
    height: 100,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  signedLabel: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  dateTimeButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateTimeText: {
    ...typography.body,
    color: colors.foreground,
  },
  dateTimePlaceholder: {
    color: colors.mutedForeground,
  },
  bottomButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.muted,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  progressText: {
    ...typography.caption,
    color: colors.mutedForeground,
    minWidth: 50,
    textAlign: 'right',
  },
});

export function FormFillout({ template, onSubmit, onCancel, isSubmitting }: FormFilloutProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [activeSignatureField, setActiveSignatureField] = useState<string | null>(null);
  const [signaturePoints, setSignaturePoints] = useState<SignaturePoint[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<SignaturePoint[]>([]);
  const [signatureCanvasLayout, setSignatureCanvasLayout] = useState({ width: 0, height: 0 });

  const fields = Array.isArray(template.fields) ? template.fields : [];

  const getFieldValue = (fieldId: string) => responses[fieldId];
  
  const setFieldValue = (fieldId: string, value: any) => {
    setResponses(prev => ({ ...prev, [fieldId]: value }));
  };

  const isFieldComplete = (field: FormField): boolean => {
    const value = responses[field.id];
    if (field.type === 'checkbox') return value === true;
    if (field.type === 'signature') return !!signatures[field.id];
    if (field.type === 'photo') return !!photos[field.id];
    return value !== undefined && value !== '';
  };

  const completedCount = fields.filter(f => isFieldComplete(f)).length;
  const progress = fields.length > 0 ? completedCount / fields.length : 0;

  const canSubmit = () => {
    const requiredFields = fields.filter(f => f.required);
    return requiredFields.every(f => isFieldComplete(f));
  };

  const handlePhotoPress = async (fieldId: string) => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos(prev => ({ ...prev, [fieldId]: result.assets[0].uri }));
    }
  };

  const handleSignatureTouch = (event: any, isStart: boolean) => {
    const { locationX, locationY } = event.nativeEvent;
    const point: SignaturePoint = { x: locationX, y: locationY };
    
    if (isStart) {
      setCurrentStroke([point]);
    } else {
      setCurrentStroke(prev => [...prev, point]);
    }
  };

  const handleSignatureTouchEnd = () => {
    if (currentStroke.length > 0) {
      setSignaturePoints(prev => [...prev, currentStroke]);
      setCurrentStroke([]);
    }
  };

  const generateSignatureSvgPath = (): string => {
    const allStrokes = [...signaturePoints, currentStroke];
    return allStrokes
      .filter(stroke => stroke.length > 0)
      .map(stroke => {
        const pathData = stroke
          .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
          .join(' ');
        return pathData;
      })
      .join(' ');
  };

  const clearSignature = () => {
    setSignaturePoints([]);
    setCurrentStroke([]);
  };

  const saveSignature = () => {
    if (activeSignatureField && signaturePoints.length > 0) {
      const svgData = generateSignatureSvgPath();
      setSignatures(prev => ({ ...prev, [activeSignatureField]: svgData }));
      setActiveSignatureField(null);
      setSignaturePoints([]);
      setCurrentStroke([]);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit()) {
      Alert.alert('Incomplete Form', 'Please complete all required fields before submitting.');
      return;
    }

    const finalResponses = {
      ...responses,
      ...Object.entries(signatures).reduce((acc, [key, val]) => ({ ...acc, [key]: `signature:${val}` }), {}),
      ...Object.entries(photos).reduce((acc, [key, val]) => ({ ...acc, [key]: `photo:${val}` }), {}),
    };

    const photoUris = Object.values(photos);
    await onSubmit(finalResponses, photoUris);
  };

  const renderField = (field: FormField) => {
    const value = getFieldValue(field.id);

    switch (field.type) {
      case 'text':
      case 'number':
        return (
          <TextInput
            style={styles.textInput}
            value={value || ''}
            onChangeText={(text) => setFieldValue(field.id, text)}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            placeholderTextColor={colors.mutedForeground}
            keyboardType={field.type === 'number' ? 'numeric' : 'default'}
            data-testid={`input-${field.id}`}
          />
        );

      case 'textarea':
        return (
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={value || ''}
            onChangeText={(text) => setFieldValue(field.id, text)}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={4}
            data-testid={`textarea-${field.id}`}
          />
        );

      case 'checkbox':
        return (
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setFieldValue(field.id, !value)}
            activeOpacity={0.7}
            data-testid={`checkbox-${field.id}`}
          >
            <View style={[styles.checkbox, value && styles.checkboxChecked]}>
              {value && <Feather name="check" size={18} color={colors.white} />}
            </View>
            <Text style={styles.checkboxLabel}>{field.label}</Text>
          </TouchableOpacity>
        );

      case 'select':
        return (
          <View style={styles.selectContainer}>
            {(field.options || []).map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.selectOption,
                  value === option && styles.selectOptionSelected,
                ]}
                onPress={() => setFieldValue(field.id, option)}
                activeOpacity={0.7}
                data-testid={`select-${field.id}-${option}`}
              >
                <Text style={[
                  styles.selectOptionText,
                  value === option && styles.selectOptionTextSelected,
                ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'photo':
        return (
          <View style={styles.photoContainer}>
            {photos[field.id] ? (
              <View style={styles.photoPreview}>
                <Image source={{ uri: photos[field.id] }} style={styles.photoImage} />
                <TouchableOpacity
                  style={styles.removePhotoButton}
                  onPress={() => setPhotos(prev => {
                    const newPhotos = { ...prev };
                    delete newPhotos[field.id];
                    return newPhotos;
                  })}
                >
                  <Feather name="x" size={14} color={colors.white} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.photoButton}
                onPress={() => handlePhotoPress(field.id)}
                data-testid={`photo-${field.id}`}
              >
                <Feather name="camera" size={24} color={colors.mutedForeground} />
                <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 4 }}>
                  Take Photo
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );

      case 'signature':
        if (signatures[field.id]) {
          return (
            <View>
              <View style={styles.signaturePreview}>
                <Feather name="check-circle" size={24} color={colors.success} />
                <Text style={[styles.signedLabel, { marginTop: spacing.xs }]}>Signed</Text>
              </View>
              <TouchableOpacity
                style={[styles.clearButton, { marginTop: spacing.sm }]}
                onPress={() => {
                  setSignatures(prev => {
                    const newSigs = { ...prev };
                    delete newSigs[field.id];
                    return newSigs;
                  });
                }}
              >
                <Text style={styles.clearButtonText}>Clear Signature</Text>
              </TouchableOpacity>
            </View>
          );
        }

        if (activeSignatureField === field.id) {
          return (
            <View style={styles.signatureContainer}>
              <View
                style={styles.signatureCanvas}
                onLayout={(event) => {
                  const { width, height } = event.nativeEvent.layout;
                  setSignatureCanvasLayout({ width, height });
                }}
                onTouchStart={(e) => handleSignatureTouch(e, true)}
                onTouchMove={(e) => handleSignatureTouch(e, false)}
                onTouchEnd={handleSignatureTouchEnd}
              >
                {signaturePoints.length === 0 && currentStroke.length === 0 && (
                  <View style={styles.signatureCanvasPlaceholder}>
                    <Text style={styles.signatureCanvasPlaceholderText}>Sign here</Text>
                  </View>
                )}
                <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
                  <Path
                    d={generateSignatureSvgPath()}
                    stroke={colors.foreground}
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View style={styles.signatureButtons}>
                <TouchableOpacity style={styles.clearButton} onPress={clearSignature}>
                  <Text style={styles.clearButtonText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.clearButton, { backgroundColor: colors.primary }]} 
                  onPress={saveSignature}
                >
                  <Text style={[styles.clearButtonText, { color: colors.white }]}>Save Signature</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }

        return (
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => setActiveSignatureField(field.id)}
            data-testid={`signature-${field.id}`}
          >
            <Text style={[styles.dateTimeText, styles.dateTimePlaceholder]}>
              Tap to sign
            </Text>
            <Feather name="edit-3" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        );

      case 'date':
        return (
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => {
              const today = new Date().toISOString().split('T')[0];
              setFieldValue(field.id, today);
            }}
            data-testid={`date-${field.id}`}
          >
            <Text style={[styles.dateTimeText, !value && styles.dateTimePlaceholder]}>
              {value || 'Select date'}
            </Text>
            <Feather name="calendar" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        );

      case 'time':
        return (
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => {
              const now = new Date();
              const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
              setFieldValue(field.id, time);
            }}
            data-testid={`time-${field.id}`}
          >
            <Text style={[styles.dateTimeText, !value && styles.dateTimePlaceholder]}>
              {value || 'Select time'}
            </Text>
            <Feather name="clock" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
          <Feather name="x" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{template.name}</Text>
        <TouchableOpacity 
          style={styles.submitButton} 
          onPress={handleSubmit}
          disabled={!canSubmit() || isSubmitting}
        >
          <Text style={[
            styles.submitButtonText,
            (!canSubmit() || isSubmitting) && styles.submitButtonDisabled,
          ]}>
            {isSubmitting ? 'Saving...' : 'Submit'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>{completedCount}/{fields.length}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {fields.map((field) => (
          <View key={field.id} style={styles.fieldContainer}>
            {field.type !== 'checkbox' && (
              <View style={styles.labelRow}>
                <Text style={styles.label}>{field.label}</Text>
                {field.required && <Text style={styles.required}>*</Text>}
                {isFieldComplete(field) && (
                  <Feather name="check-circle" size={16} color={colors.success} />
                )}
              </View>
            )}
            {renderField(field)}
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottomButtons}>
        <Button variant="outline" onPress={onCancel} style={{ flex: 1 }}>
          Cancel
        </Button>
        <Button 
          variant="default" 
          onPress={handleSubmit} 
          disabled={!canSubmit() || isSubmitting}
          style={{ flex: 2 }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Form'}
        </Button>
      </View>
    </View>
  );
}
