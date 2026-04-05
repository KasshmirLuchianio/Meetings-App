import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Dimensions, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const ORB_SIZE = width * 0.75;

export default function RecordingOrb({ isRecording }: { isRecording: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);
  const rotateRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isRecording) {
      // Fade in
      Animated.timing(opacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();

      // Pulsare organică
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.08,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.96,
            duration: 1400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      pulseRef.current.start();

      // Rotație lentă
      rotation.setValue(0);
      rotateRef.current = Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 8000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      rotateRef.current.start();
    } else {
      // Stop animations
      pulseRef.current?.stop();
      rotateRef.current?.stop();

      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start();

      Animated.timing(scale, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      pulseRef.current?.stop();
      rotateRef.current?.stop();
    };
  }, [isRecording]);

  const rotateInterpolation = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.orbContainer,
        {
          opacity,
          transform: [{ scale }, { rotate: rotateInterpolation }],
        },
      ]}
    >
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
