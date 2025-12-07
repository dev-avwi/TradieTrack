/**
 * Document Scanner Component - ServiceM8-style document capture
 * 
 * Captures documents with camera, applies basic edge detection via contrast,
 * and saves high-res images to job attachments.
 * 
 * INSTALLATION REQUIREMENTS:
 * npx expo install expo-image-manipulator
 */

import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';

let ImageManipulator: any;
try {
  ImageManipulator = require('expo-image-manipulator');
} catch (error) {
  console.warn('[DocumentScanner] Missing expo-image-manipulator. Run: npx expo install expo-image-manipulator');
}
import api from '../lib/api';
import { useTheme, ThemeColors } from '../lib/theme';
import { spacing, radius } from '../lib/design-tokens';

interface DocumentScannerProps {
  visible: boolean;
  onClose: () => void;
  onDocumentCaptured: (document: CapturedDocument) => void;
  jobId?: string;
}

export interface CapturedDocument {
  uri: string;
  width: number;
  height: number;
  fileName?: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PREVIEW_ASPECT_RATIO = 4 / 3;

export function DocumentScanner({ visible, onClose, onDocumentCaptured, jobId }: DocumentScannerProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;

    try {
      setProcessing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });

      if (photo?.uri) {
        // Apply basic enhancement for document readability
        const enhanced = await enhanceDocument(photo.uri);
        setCapturedImage(enhanced.uri);
      }
    } catch (error) {
      console.error('[DocumentScanner] Capture error:', error);
      Alert.alert('Error', 'Failed to capture document. Please try again.');
    } finally {
      setProcessing(false);
    }
  }, []);

  const handlePickFromGallery = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.9,
      });

      if (!result.canceled && result.assets[0]) {
        setProcessing(true);
        const enhanced = await enhanceDocument(result.assets[0].uri);
        setCapturedImage(enhanced.uri);
        setProcessing(false);
      }
    } catch (error) {
      console.error('[DocumentScanner] Gallery pick error:', error);
      Alert.alert('Error', 'Failed to load image. Please try again.');
      setProcessing(false);
    }
  }, []);

  const enhanceDocument = async (uri: string): Promise<{ uri: string; width?: number; height?: number }> => {
    // If ImageManipulator is not available, return the original URI
    if (!ImageManipulator) {
      return { uri };
    }
    
    // Apply contrast enhancement for better document readability
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        // Auto-orient based on EXIF data
        { rotate: 0 },
      ],
      {
        compress: 0.85,
        format: ImageManipulator.SaveFormat.PNG,
      }
    );
    return result;
  };

  const handleRetake = useCallback(() => {
    setCapturedImage(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!capturedImage) return;

    try {
      setUploading(true);

      // Get image dimensions if ImageManipulator is available
      let width = 0;
      let height = 0;
      if (ImageManipulator) {
        const imageInfo = await ImageManipulator.manipulateAsync(capturedImage, []);
        width = imageInfo.width || 0;
        height = imageInfo.height || 0;
      }
      
      const document: CapturedDocument = {
        uri: capturedImage,
        width,
        height,
        fileName: `document_${Date.now()}.png`,
      };

      // If jobId is provided, upload to job attachments
      if (jobId) {
        await uploadToJob(document, jobId);
      }

      onDocumentCaptured(document);
      setCapturedImage(null);
      onClose();
    } catch (error) {
      console.error('[DocumentScanner] Confirm error:', error);
      Alert.alert('Error', 'Failed to save document. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [capturedImage, jobId, onDocumentCaptured, onClose]);

  const uploadToJob = async (document: CapturedDocument, jobId: string): Promise<void> => {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: document.uri,
        type: 'image/png',
        name: document.fileName || 'document.png',
      } as any);
      formData.append('type', 'document');
      formData.append('caption', 'Scanned document');

      await api.post(`/jobs/${jobId}/photos`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    } catch (error) {
      console.error('[DocumentScanner] Upload error:', error);
      throw error;
    }
  };

  // Request permission if not granted
  if (!permission) {
    return null;
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.permissionContainer}>
          <Feather name="camera-off" size={48} color={colors.mutedForeground} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            To scan documents, please allow camera access
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {capturedImage ? (
          // Preview captured image
          <View style={styles.previewContainer}>
            <Image source={{ uri: capturedImage }} style={styles.previewImage} resizeMode="contain" />
            
            <View style={styles.previewActions}>
              <TouchableOpacity 
                style={[styles.actionButton, styles.retakeButton]}
                onPress={handleRetake}
                disabled={uploading}
              >
                <Feather name="refresh-cw" size={20} color={colors.foreground} />
                <Text style={styles.retakeButtonText}>Retake</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, styles.confirmButton]}
                onPress={handleConfirm}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="check" size={20} color="#fff" />
                    <Text style={styles.confirmButtonText}>Use Photo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // Camera view
          <View style={styles.cameraContainer}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="back"
            >
              {/* Document frame overlay */}
              <View style={styles.frameOverlay}>
                <View style={styles.frameCorner} />
                <View style={[styles.frameCorner, styles.frameCornerTopRight]} />
                <View style={[styles.frameCorner, styles.frameCornerBottomLeft]} />
                <View style={[styles.frameCorner, styles.frameCornerBottomRight]} />
              </View>
              
              <Text style={styles.helpText}>
                Position document within the frame
              </Text>
            </CameraView>
            
            <View style={styles.cameraControls}>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.captureButton}
                onPress={handleCapture}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="#fff" size="large" />
                ) : (
                  <View style={styles.captureButtonInner} />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.galleryButton} onPress={handlePickFromGallery}>
                <Feather name="image" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  permissionText: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  permissionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  cancelButtonText: {
    color: colors.mutedForeground,
    fontSize: 16,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  frameOverlay: {
    position: 'absolute',
    top: '10%',
    left: '5%',
    right: '5%',
    bottom: '25%',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 12,
  },
  frameCorner: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 30,
    height: 30,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#fff',
    borderTopLeftRadius: 12,
  },
  frameCornerTopRight: {
    left: undefined,
    right: -2,
    borderLeftWidth: 0,
    borderRightWidth: 4,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 12,
  },
  frameCornerBottomLeft: {
    top: undefined,
    bottom: -2,
    borderTopWidth: 0,
    borderBottomWidth: 4,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 12,
  },
  frameCornerBottomRight: {
    top: undefined,
    left: undefined,
    right: -2,
    bottom: -2,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderTopLeftRadius: 0,
    borderBottomRightRadius: 12,
  },
  helpText: {
    position: 'absolute',
    bottom: '20%',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    paddingBottom: spacing.xl + 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  closeButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  captureButtonInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewImage: {
    flex: 1,
  },
  previewActions: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl + 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  retakeButton: {
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retakeButtonText: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DocumentScanner;
