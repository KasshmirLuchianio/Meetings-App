import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Mic, Square, Loader2 } from 'lucide-react-native';
import { COLORS, TOUCH_TARGET } from '../constants/theme';
import { RECORDING_CONFIG } from '../constants/config';

interface RecorderProps {
  onRecordingComplete: (uri: string, duration: number) => void;
}

export default function AudioRecorder({ onRecordingComplete }: RecorderProps) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      // Request permissions
      if (permissionResponse?.status !== 'granted') {
        const { status } = await requestPermission();
        if (status !== 'granted') {
          alert('Permisiune microfon necesară pentru înregistrare');
          return;
        }
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Recording options - cross-platform compatible
      const recordingOptions = {
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: RECORDING_CONFIG.sampleRate,
          numberOfChannels: RECORDING_CONFIG.numberOfChannels,
          bitRate: RECORDING_CONFIG.bitRate,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: RECORDING_CONFIG.sampleRate,
          numberOfChannels: RECORDING_CONFIG.numberOfChannels,
          bitRate: RECORDING_CONFIG.bitRate,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: RECORDING_CONFIG.bitRate,
        },
      };

      const { recording: newRecording } = await Audio.Recording.createAsync(
        recordingOptions as any
      );

      setRecording(newRecording);
      setIsRecording(true);
      setDuration(0);

      // Haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Eroare la pornirea înregistrării');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = recording.getURI();
      
      // Haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (uri) {
        onRecordingComplete(uri, duration);
      }

      setRecording(null);
      setDuration(0);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      alert('Eroare la oprirea înregistrării');
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View className="items-center">
      {isRecording && (
        <View className="mb-6">
          <Text className="text-navy text-5xl font-mono font-bold text-center">
            {formatDuration(duration)}
          </Text>
          <Text className="text-gray-600 text-sm font-body text-center mt-2">
            Înregistrare în curs...
          </Text>
        </View>
      )}

      <Pressable
        onPress={isRecording ? stopRecording : startRecording}
        className="items-center justify-center rounded-full active:scale-95"
        style={{
          width: TOUCH_TARGET.large,
          height: TOUCH_TARGET.large,
          backgroundColor: isRecording ? COLORS.error : COLORS.navy,
        }}
      >
        {isRecording ? (
          <Square size={32} color="white" fill="white" />
        ) : (
          <Mic size={32} color="white" />
        )}
      </Pressable>

      <Text className="text-gray-600 text-sm font-body mt-4">
        {isRecording ? 'Apasă pentru oprire' : 'Apasă pentru înregistrare'}
      </Text>
    </View>
  );
}
