import React, { useState, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { Upload, FileAudio, X } from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import { API_BASE_URL, UPLOAD_CONFIG } from '../constants/config';
import { authenticatedFetch } from '../utils/authenticatedFetch';

interface UploadProgress {
  totalBytesSent: number;
  totalBytesExpectedToSend: number;
  percentage: number;
}

interface AudioUploaderProps {
  onUploadComplete: (meetingId: string) => void;
  onLimitReached?: (message: string) => void;
}

const getMimeType = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    m4a: 'audio/m4a',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    webm: 'audio/webm',
    ogg: 'audio/ogg',
    aac: 'audio/aac',
    flac: 'audio/flac',
  };
  return map[ext || ''] || 'audio/mpeg';
};

export default function AudioUploader({ onUploadComplete, onLimitReached }: AudioUploaderProps) {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({
    totalBytesSent: 0,
    totalBytesExpectedToSend: 0,
    percentage: 0,
  });

  const handlePickFile = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];

      // Validate file size (max 100MB)
      if (file.size && file.size > UPLOAD_CONFIG.maxFileSizeMB * 1024 * 1024) {
        alert(`Fișierul este prea mare. Mărimea maximă: ${UPLOAD_CONFIG.maxFileSizeMB} MB`);
        return;
      }

      setSelectedFile(file);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('File picker error:', error);
      alert('Eroare la selectarea fișierului');
    }
  };

  const uploadWithRetry = async (
    uri: string,
    meetingId: string,
    attempt: number = 0
  ): Promise<void> => {
    const token = await SecureStore.getItemAsync('auth_token');

    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Progress tracking
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentage = Math.round((e.loaded / e.total) * 100);
          setProgress({
            totalBytesSent: e.loaded,
            totalBytesExpectedToSend: e.total,
            percentage,
          });
        }
      };

      // Success handler
      xhr.onload = () => {
        if (xhr.status === 200) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      // Error handler
      xhr.onerror = () => {
        reject(new Error('Network error during upload'));
      };

      // Prepare form data
      const formData = new FormData();
      formData.append('file', {
        uri,
        type: getMimeType(selectedFile.name),
        name: selectedFile.name || `audio_${Date.now()}.m4a`,
      } as any);

      // Send request with auth
      xhr.open('POST', `${API_BASE_URL}/api/meetings/${meetingId}/upload`);
      xhr.setRequestHeader('Accept', 'application/json');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(formData);
    }).catch(async (error) => {
      if (attempt < UPLOAD_CONFIG.maxRetries - 1) {
        // Retry with exponential backoff
        const backoffMs = UPLOAD_CONFIG.backoffMs[attempt];
        // retry with exponential backoff (attempt ${attempt + 1})
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return uploadWithRetry(uri, meetingId, attempt + 1);
      }
      throw error;
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setProgress({ totalBytesSent: 0, totalBytesExpectedToSend: 0, percentage: 0 });

    try {
      // Step 1: Create meeting placeholder
      const createResponse = await authenticatedFetch(`${API_BASE_URL}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vertical_type: 'GENERAL' }),
      });

      if (createResponse.status === 402) {
        const err = await createResponse.json().catch(() => ({ limit: 0, plan: 'free' }));
        if (onLimitReached) {
          onLimitReached(err.detail || `Ai folosit toate cele ${err.limit} înregistrări din planul ${(err.plan || 'FREE').toUpperCase()}.`);
        } else {
          Alert.alert(
            'Limită atinsă',
            `Ai folosit toate cele ${err.limit} înregistrări din planul ${(err.plan || 'FREE').toUpperCase()}. Upgradează pentru a continua.`,
            [
              { text: 'Mai târziu', style: 'cancel' },
              { text: 'Vezi planuri', onPress: () => router.push('/pricing') },
            ]
          );
        }
        setUploading(false);
        return;
      }

      if (!createResponse.ok) {
        throw new Error('Failed to create meeting');
      }

      const meeting = await createResponse.json();

      // Step 2: Upload with retry
      await uploadWithRetry(selectedFile.uri, meeting._id);

      // Success
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedFile(null);
      setUploading(false);
      setProgress({ totalBytesSent: 0, totalBytesExpectedToSend: 0, percentage: 0 });
      onUploadComplete(meeting._id);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Eroare la încărcare. Te rugăm încearcă din nou.');
      setUploading(false);
      setProgress({ totalBytesSent: 0, totalBytesExpectedToSend: 0, percentage: 0 });
    }
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFile(null);
    setProgress({ totalBytesSent: 0, totalBytesExpectedToSend: 0, percentage: 0 });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (!selectedFile) {
    return (
      <View className="items-center p-6 bg-white rounded-2xl">
        <View
          className="h-16 w-16 rounded-2xl items-center justify-center mb-4"
          style={{ backgroundColor: COLORS.navy + '10' }}
        >
          <Upload size={32} color={COLORS.navy} />
        </View>

        <Text className="text-navy text-lg font-heading mb-2">Încarcă înregistrare</Text>
        <Text className="text-gray-600 text-sm font-body text-center mb-4">
          Selectează un fișier audio înregistrat offline
        </Text>

        <Pressable
          onPress={handlePickFile}
          className="w-full h-14 bg-navy rounded-xl items-center justify-center flex-row gap-2 active:scale-95"
        >
          <FileAudio size={20} color="white" />
          <Text className="text-white text-base font-heading">Selectează fișier audio</Text>
        </Pressable>

        <Text className="text-gray-500 text-xs font-body mt-3 text-center">
          Format: MP3, WAV, M4A, WEBM, OGG • Max {UPLOAD_CONFIG.maxFileSizeMB} MB
        </Text>
      </View>
    );
  }

  return (
    <View className="p-6 bg-white rounded-2xl">
      {/* File preview */}
      <View className="flex-row items-start gap-3 p-4 rounded-xl bg-navy/5 mb-4">
        <View
          className="h-10 w-10 rounded-lg items-center justify-center"
          style={{ backgroundColor: COLORS.navy + '20' }}
        >
          <FileAudio size={20} color={COLORS.navy} />
        </View>

        <View className="flex-1 min-w-0">
          <Text className="text-navy font-heading text-sm" numberOfLines={1}>
            {selectedFile.name}
          </Text>
          <Text className="text-gray-600 text-xs font-body mt-1">
            {selectedFile.size ? formatFileSize(selectedFile.size) : 'Unknown size'}
          </Text>
        </View>

        {!uploading && (
          <Pressable onPress={handleCancel} className="h-8 w-8 items-center justify-center">
            <X size={20} color={COLORS.navy} />
          </Pressable>
        )}
      </View>

      {/* Progress bar */}
      {uploading && (
        <View className="mb-4">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-gray-600 text-sm font-body">Se încarcă...</Text>
            <Text className="text-navy text-sm font-heading">{progress.percentage}%</Text>
          </View>

          <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{
                width: `${progress.percentage}%`,
                backgroundColor: COLORS.navy,
              }}
            />
          </View>
        </View>
      )}

      {/* Upload button */}
      {!uploading && (
        <Pressable
          onPress={handleUpload}
          className="w-full h-14 bg-navy rounded-xl items-center justify-center flex-row gap-2 active:scale-95"
        >
          <Upload size={20} color="white" />
          <Text className="text-white text-base font-heading">Încarcă și procesează</Text>
        </Pressable>
      )}

      {uploading && (
        <View className="w-full h-14 bg-gray-200 rounded-xl items-center justify-center flex-row gap-2">
          <ActivityIndicator size="small" color={COLORS.navy} />
          <Text className="text-navy text-base font-body">Se procesează...</Text>
        </View>
      )}
    </View>
  );
}
