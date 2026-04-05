import React, { useEffect } from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const ORB_SIZE = width * 0.75;

export default function RecordingOrb({ isRecording }: { isRecording: boolean }) {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (isRecording) {
      // Fade in
      opacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
      // Pulsare organică
      scale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.sine) }),
          withTiming(0.96, { duration: 1400, easing: Easing.inOut(Easing.sine) }),
        ),
        -1,
        true
      );
      // Rotație lentă
      rotation.value = withRepeat(
        withTiming(360, { duration: 8000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      opacity.value = withTiming(0, { duration: 400 });
      scale.value = withTiming(1, { duration: 400 });
    }
  }, [isRecording]);

  const orbStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.orbContainer, orbStyle]}>
      <LinearGradient
        colors={['#7B2FFF', '#00CFFF', '#FF6B9D', '#7B2FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.orb}
      />
      {/* Glass highlight */}
      <LinearGradient
        colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 0.6 }}
        style={styles.highlight}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  orbContainer: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    overflow: 'hidden',
    shadowColor: '#7B2FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 60,
    elevation: 30,
  },
  orb: {
    width: '100%',
    height: '100%',
    borderRadius: ORB_SIZE / 2,
  },
  highlight: {
    position: 'absolute',
    top: '8%',
    left: '10%',
    width: '60%',
    height: '45%',
    borderRadius: ORB_SIZE / 2,
  },
});
