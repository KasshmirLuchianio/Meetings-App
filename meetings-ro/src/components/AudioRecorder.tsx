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

  // Duration thresholds
  const WARNING_THRESHOLD_SECONDS = 20 * 60;  // 20 min — first warning
  const SOFT_LIMIT_SECONDS = 25 * 60;         // 25 min — strong warning (Groq limit zone)
  const HARD_LIMIT_SECONDS = 120 * 60;        // 120 min — auto-stop

  // One-time warning flags (reset on each new recording)
  const warned20Ref = useRef(false);
  const warned25Ref = useRef(false);

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
      warned25Ref.current = false;
      setDuration('00:00');
      setDurationSeconds(0);
      setIsRecording(true);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      timerRef.current = setInterval(() => {
        durationSecondsRef.current += 1;
        const secs = durationSecondsRef.current;
        setDuration(formatDuration(secs));
        setDurationSeconds(secs);

        // ── HARD LIMIT: auto-stop at 2 hours ──────────────────────────
        if (secs >= HARD_LIMIT_SECONDS) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          Alert.alert(
            'Înregistrare oprită automat',
            'Limita maximă de 2 ore a fost atinsă. Înregistrarea va fi salvată acum.',
            [{ text: 'OK' }]
          );
          stopRecordingRef.current?.();
          return;
        }

        // ── SOFT LIMIT: strong warning at 25 min (Groq 25 MB zone) ────
        if (secs === SOFT_LIMIT_SECONDS && !warned25Ref.current) {
          warned25Ref.current = true;
          Alert.alert(
            '⚠️ Înregistrare lungă',
            'Ai depășit 25 de minute. Fișierul este mare — va fi procesat automat în segmente.\n\nPoți continua sau opri înregistrarea.',
            [{ text: 'Continuă' }]
          );
        }

        // ── WARNING: first alert at 20 min ────────────────────────────
        if (secs === WARNING_THRESHOLD_SECONDS && !warned20Ref.current) {
          warned20Ref.current = true;
          Alert.alert(
            'Atenție: 20 de minute',
            'Înregistrarea durează deja 20 de minute.\n\nFișierele mai mari de 25 min sunt procesate în segmente automat.',
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
