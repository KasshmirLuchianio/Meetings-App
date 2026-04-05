import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Linking, Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Mic } from 'lucide-react-native';
import { COLORS, TOUCH_TARGET } from '../constants/theme';
import { RECORDING_CONFIG } from '../constants/config';
import { useRecording } from '../context/RecordingContext';

interface RecorderProps {
  onRecordingComplete: (uri: string, duration: number) => void;
}

export default function AudioRecorder({ onRecordingComplete }: RecorderProps) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const durationSecondsRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const {
    isRecording,
    setIsRecording,
    setDuration,
    registerStopHandler,
  } = useRecording();

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const stopRecording = useCallback(async () => {
    const rec = recordingRef.current;
    if (!rec) return;

    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setIsRecording(false);

      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = rec.getURI();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (uri) {
        onRecordingComplete(uri, durationSecondsRef.current);
      }

      setRecording(null);
      recordingRef.current = null;
      durationSecondsRef.current = 0;
      setDuration('00:00');
    } catch (error) {
      console.error('Failed to stop recording:', error);
      alert('Eroare la oprirea înregistrării');
    }
  }, [onRecordingComplete, setIsRecording, setDuration]);

  // Register stop handler so RecordingScreen can call it
  useEffect(() => {
    registerStopHandler(stopRecording);
  }, [stopRecording, registerStopHandler]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      if (permissionResponse?.status !== 'granted') {
        const { status, canAskAgain } = await requestPermission();
        if (status !== 'granted') {
          if (!canAskAgain) {
            Alert.alert(
              'Permisiune necesară',
              'Accesul la microfon a fost blocat. Deschide Setările aplicației pentru a-l activa.',
              [
                { text: 'Anulează', style: 'cancel' },
                { text: 'Deschide Setări', onPress: () => Linking.openSettings() },
              ]
            );
          } else {
            alert('Permisiune microfon necesară pentru înregistrare');
          }
          return;
        }
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

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
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: RECORDING_CONFIG.bitRate,
        },
      };

      const { recording: newRecording } = await Audio.Recording.createAsync(
        recordingOptions as any,
        undefined,
        100
      );

      setRecording(newRecording);
      recordingRef.current = newRecording;
      durationSecondsRef.current = 0;
      setDuration('00:00');
      setIsRecording(true);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      timerRef.current = setInterval(() => {
        durationSecondsRef.current += 1;
        setDuration(formatDuration(durationSecondsRef.current));
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Eroare la pornirea înregistrării');
    }
  };

  return (
    <View className="items-center">
      {!isRecording && (
        <>
          <Pressable
            onPress={startRecording}
            className="items-center justify-center rounded-full active:scale-95"
            style={{
              width: TOUCH_TARGET.large,
              height: TOUCH_TARGET.large,
              backgroundColor: COLORS.navy,
            }}
          >
            <Mic size={32} color="white" />
          </Pressable>

          <Text className="text-gray-600 text-sm font-body mt-4">
            Apasă pentru înregistrare
          </Text>
        </>
      )}
    </View>
  );
}
