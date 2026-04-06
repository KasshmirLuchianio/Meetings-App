import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, Image, StyleSheet } from 'react-native';

export default function SlideShield() {
  const glow = useRef(new Animated.Value(0.75)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -10,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1.0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.75,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={{
      transform: [{ translateY: floatAnim }],
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Blue glow behind shield */}
      <Animated.View style={[styles.glowBg, { opacity: glow }]} />

      <Image
        source={require('../../../assets/onboarding/shield.png')}
        style={styles.shield}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shield: {
    width: 220,
    height: 220,
  },
  glowBg: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(100, 160, 255, 0.15)',
    shadowColor: '#4A90FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 40,
    elevation: 20,
  },
});
