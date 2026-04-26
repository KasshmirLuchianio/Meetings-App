import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Linking, Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Mic } from 'lucide-react-native';
import { COLORS, TOUCH_TARGET } from '../constants/theme';
import { RECORDING_CONFIG } from '../constants/config';
import { useRecording } from '../context/RecordingContext';

const FILE_SIZE_WARN_MB = 20;   // informational alert threshold
const BYTES_PER_MB = 1024 * 1024;

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
    setDurationSeconds,
    registerStopHandler,
  } = useRecording();

  // Duration thresholds — informational only, no auto-stop ever
  const WARNING_THRESHOLD_SECONDS = 20 * 60;  // 20 min — gentle note
  const INFO_THRESHOLD_SECONDS = 60 * 60;     // 60 min — reassure user about chunking

  // One-time notification flags (reset on each new recording)
  const warned20Ref = useRef(false);
  const warnedInfoRef = useRef(false);

  // Stable ref to stopRecording so the interval closure can always call the latest version
  const stopRecordingRef = useRef<(() => Promise<void>) | null>(null);

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
        // ── File size check — inform user before upload ──────────────
        try {
          const info = await FileSystem.getInfoAsync(uri, { size: true });
          if (info.exists && info.size) {
            const sizeMB = info.size / BYTES_PER_MB;
            if (sizeMB > FILE_SIZE_WARN_MB) {
              Alert.alert(
                'Fișier mare detectat',
                `Înregistrarea are ${sizeMB.toFixed(1)} MB. Va fi procesată automat în segmente — nu este nevoie de nicio acțiune din partea ta.`,
                [{ text: 'OK' }]
              );
            }
          }
        } catch (sizeErr) {
          // Non-critical — log and continue
          console.warn('Could not read file size:', sizeErr);
        }

        onRecordingComplete(uri, durationSecondsRef.current);
      }

      setRecording(null);
      recordingRef.current = null;
      durationSecondsRef.current = 0;
      setDuration('00:00');
      setDurationSeconds(0);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      alert('Eroare la oprirea înregistrării');
    }
  }, [onRecordingComplete, setIsRecording, setDuration, setDurationSeconds]);

  // Register stop handler so RecordingScreen can call it
  useEffect(() => {
    registerStopHandler(stopRecording);
  }, [stopRecording, registerStopHandler]);

  // Keep stopRecordingRef in sync so the setInterval closure can call it safely
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

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
      warned20Ref.current = false;
      warnedInfoRef.current = false;
      setDuration('00:00');
      setDurationSeconds(0);
      setIsRecording(true);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      timerRef.current = setInterval(() => {
        durationSecondsRef.current += 1;
        const secs = durationSecondsRef.current;
        setDuration(formatDuration(secs));
        setDurationSeconds(secs);

        // ── 60 min: reassure user that chunking handles everything ────
        if (secs === INFO_THRESHOLD_SECONDS && !warnedInfoRef.current) {
          warnedInfoRef.current = true;
          Alert.alert(
            'Înregistrare lungă',
            'Înregistrarea durează deja o oră — totul e în regulă.\n\nFișierul va fi procesat automat în segmente. Poți continua oricât.',
            [{ text: 'Continuă' }]
          );
        }

        // ── 20 min: gentle first note ─────────────────────────────────
        if (secs === WARNING_THRESHOLD_SECONDS && !warned20Ref.current) {
          warned20Ref.current = true;
          Alert.alert(
            '20 de minute',
            'Înregistrarea durează deja 20 de minute.\n\nPoți continua — fișierele lungi sunt procesate automat în segmente.',
            [{ text: 'OK' }]
          );
        }
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
