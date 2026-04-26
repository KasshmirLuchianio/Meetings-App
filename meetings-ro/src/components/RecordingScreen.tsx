import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import RecordingOrb from './RecordingOrb';
import { useRecording } from '../context/RecordingContext';

const WARNING_THRESHOLD_SECONDS = 20 * 60;   // gentle orange tint at 20 min
const INFO_THRESHOLD_SECONDS = 60 * 60;      // reassuring info note at 60 min

export default function RecordingScreen() {
  const { isRecording, duration, durationSeconds, stopRecording } = useRecording();
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(bgOpacity, {
      toValue: isRecording ? 1 : 0,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isRecording]);

  if (!isRecording && (bgOpacity as any)._value === 0) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { opacity: bgOpacity }]} pointerEvents={isRecording ? 'auto' : 'none'}>
      <View style={styles.content}>
        <RecordingOrb isRecording={isRecording} />
        <Text style={[
          styles.timer,
          durationSeconds >= WARNING_THRESHOLD_SECONDS && durationSeconds < INFO_THRESHOLD_SECONDS && styles.timerWarnOrange,
        ]}>{duration}</Text>

        {durationSeconds >= INFO_THRESHOLD_SECONDS ? (
          <Text style={styles.infoNote}>Înregistrare lungă — va fi procesată automat în segmente ✓</Text>
        ) : durationSeconds >= WARNING_THRESHOLD_SECONDS ? (
          <Text style={styles.warningOrange}>Înregistrare lungă — continuă fără griji</Text>
        ) : (
          <Text style={styles.hint}>Vorbește clar și natural</Text>
        )}

        <TouchableOpacity style={styles.stopButton} onPress={stopRecording} activeOpacity={0.7}>
          <View style={styles.stopIcon} />
        </TouchableOpacity>
        <Text style={styles.stopLabel}>Oprește înregistrarea</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#050508',
    zIndex: 9999,
    elevation: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 24,
  },
  timer: {
    fontSize: 48,
    fontWeight: '300',
    color: '#FAF8F3',
    letterSpacing: 4,
  },
  timerWarnOrange: {
    color: '#FB923C',
  },
  hint: {
    fontSize: 14,
    color: 'rgba(250,248,243,0.4)',
    letterSpacing: 1,
  },
  warningOrange: {
    fontSize: 13,
    color: '#FB923C',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  infoNote: {
    fontSize: 13,
    color: 'rgba(250,248,243,0.55)',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  stopButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(250,248,243,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(250,248,243,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  stopIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#FAF8F3',
  },
  stopLabel: {
    fontSize: 12,
    color: 'rgba(250,248,243,0.4)',
    letterSpacing: 0.5,
  },
});
