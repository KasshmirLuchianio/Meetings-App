import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Animated, Linking, Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Mic, Square, Settings } from 'lucide-react-native';
import { COLORS, TOUCH_TARGET } from '../constants/theme';
import { RECORDING_CONFIG } from '../constants/config';

interface RecorderProps {
  onRecordingComplete: (uri: string, duration: number) => void;
}

const WAVEFORM_BARS = 32;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const BAR_MAX_HEIGHT = 60;
const BAR_MIN_HEIGHT = 4;

export default function AudioRecorder({ onRecordingComplete }: RecorderProps) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const meteringRef = useRef<NodeJS.Timeout | null>(null);
  
  // Animated values for each bar
  const barHeights = useRef(
    Array.from({ length: WAVEFORM_BARS }, () => new Animated.Value(BAR_MIN_HEIGHT))
  ).current;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (meteringRef.current) clearInterval(meteringRef.current);
    };
  }, []);

  const updateWaveform = async () => {
    if (!recording) return;

    try {
      const status = await recording.getStatusAsync();
      
      // expo-av metering is in range [-160, 0] dB
      // We normalize to [0, 1] range
      let metering = 0;
      if (status.isRecording && status.metering !== undefined) {
        // Convert dB to normalized value
        // -160 dB (silent) -> 0, 0 dB (loud) -> 1
        metering = Math.max(0, Math.min(1, (status.metering + 160) / 160));
      } else {
        // Fallback: generate random values for visual effect
        metering = Math.random() * 0.3 + 0.1;
      }

      // Calculate target height based on metering
      const targetHeight = BAR_MIN_HEIGHT + (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT) * metering;

      // Animate all bars with slight variations
      barHeights.forEach((barHeight, index) => {
        // Add variation: center bars more active
        const centerOffset = Math.abs(index - WAVEFORM_BARS / 2) / (WAVEFORM_BARS / 2);
        const variation = (1 - centerOffset * 0.3) * (Math.random() * 0.3 + 0.85);
        const finalHeight = targetHeight * variation;

        Animated.timing(barHeight, {
          toValue: finalHeight,
          duration: 100,
          useNativeDriver: false, // Height is not supported by native driver
        }).start();
      });
    } catch (error) {
      console.error('Metering error:', error);
    }
  };

  const resetWaveform = () => {
    barHeights.forEach((barHeight) => {
      Animated.timing(barHeight, {
        toValue: BAR_MIN_HEIGHT,
        duration: 200,
        useNativeDriver: false,
      }).start();
    });
  };

  const startRecording = async () => {
    try {
      // Request permissions
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

      // Configure audio session — must be set BEFORE creating recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      // Small delay to let iOS audio session initialize
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Recording options with metering enabled
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
        100 // Update interval for metering (ms)
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

      // Start metering updates (16.67ms ≈ 60fps)
      meteringRef.current = setInterval(() => {
        updateWaveform();
      }, 16);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Eroare la pornirea înregistrării');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      // Stop timers
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (meteringRef.current) {
        clearInterval(meteringRef.current);
        meteringRef.current = null;
      }

      setIsRecording(false);
      resetWaveform();

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

      {/* Waveform Visualization */}
      {isRecording && (
        <View
          className="flex-row items-center justify-center mb-6"
          style={{
            height: BAR_MAX_HEIGHT + 10,
            width: WAVEFORM_BARS * (BAR_WIDTH + BAR_GAP),
          }}
        >
          {barHeights.map((barHeight, index) => (
            <Animated.View
              key={index}
              style={{
                width: BAR_WIDTH,
                height: barHeight,
                backgroundColor: COLORS.navy,
                borderRadius: BAR_WIDTH / 2,
                marginHorizontal: BAR_GAP / 2,
              }}
            />
          ))}
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
