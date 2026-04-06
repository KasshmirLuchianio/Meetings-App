import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Circle, Path, G } from 'react-native-svg';

export default function SlideMic() {
  const wave1 = useRef(new Animated.Value(0)).current;
  const wave2 = useRef(new Animated.Value(0)).current;
  const wave3 = useRef(new Animated.Value(0)).current;

  const animateWave = (anim: Animated.Value, delay: number) => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  useEffect(() => {
    animateWave(wave1, 0);
    animateWave(wave2, 400);
    animateWave(wave3, 800);
  }, []);

  return (
    <View style={styles.container}>
      <Svg width="200" height="200" viewBox="0 0 200 200">
        {/* Microfon */}
        <G>
          <Path
            d="M100 40 C85 40 75 52 75 65 L75 100 C75 113 85 125 100 125 C115 125 125 113 125 100 L125 65 C125 52 115 40 100 40Z"
            fill="#B8962E"
            opacity={0.9}
          />
          <Path
            d="M60 95 C60 120 78 140 100 140 C122 140 140 120 140 95"
            stroke="#FAF8F3"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M100 140 L100 160"
            stroke="#FAF8F3"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <Path
            d="M80 160 L120 160"
            stroke="#FAF8F3"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </G>
      </Svg>

      {/* Unde animate separate */}
      {[wave1, wave2, wave3].map((wave, i) => (
        <Animated.View
          key={i}
          style={[styles.wave, {
            width: 120 + i * 60,
            height: 120 + i * 60,
            borderRadius: (120 + i * 60) / 2,
            opacity: wave.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.6, 0.3, 0],
            }),
            transform: [{
              scale: wave.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1.4],
              }),
            }],
          }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wave: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: '#B8962E',
  },
});
