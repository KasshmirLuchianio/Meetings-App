import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Animated, Easing } from 'react-native';
import RecordingOrb from './RecordingOrb';

const { width, height } = Dimensions.get('window');

interface Props {
  isVisible: boolean;
  duration: string; // "MM:SS"
  onStop: () => void;
}

export default function RecordingScreen({ isVisible, duration, onStop }: Props) {
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(bgOpacity, {
      toValue: isVisible ? 1 : 0,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isVisible]);

  if (!isVisible && (bgOpacity as any)._value === 0) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { opacity: bgOpacity }]} pointerEvents={isVisible ? 'auto' : 'none'}>
      <View style={styles.content}>
        <RecordingOrb isRecording={isVisible} />
        <Text style={styles.timer}>{duration}</Text>
        <Text style={styles.hint}>Vorbește clar și natural</Text>
        <TouchableOpacity style={styles.stopButton} onPress={onStop} activeOpacity={0.7}>
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
    width,
    height,
    backgroundColor: '#050508',
    zIndex: 999,
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
  hint: {
    fontSize: 14,
    color: 'rgba(250,248,243,0.4)',
    letterSpacing: 1,
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
