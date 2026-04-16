import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const ORB_SIZE = width * 0.55;

export default function SlidePhone() {
  const orbScale = useRef(new Animated.Value(1)).current;
  const orbRotation = useRef(new Animated.Value(0)).current;
  const recOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Pulsare orb
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbScale, {
          toValue: 1.08,
          duration: 1400,
          easing: Easing.inOut(Easing.sine),
          useNativeDriver: true,
        }),
        Animated.timing(orbScale, {
          toValue: 0.94,
          duration: 1600,
          easing: Easing.inOut(Easing.sine),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Rotatie lenta
    Animated.loop(
      Animated.timing(orbRotation, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Blink REC
    Animated.loop(
      Animated.sequence([
        Animated.timing(recOpacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(recOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const spin = orbRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      {/* REC indicator */}
      <Animated.View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          opacity: recOpacity,
        }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#FF3232',
          }}
        />
        <Text
          style={{
            color: '#FF3232',
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 1,
          }}
        >
          REC
        </Text>
      </Animated.View>

      {/* Orb */}
      <Animated.View
        style={{
          width: ORB_SIZE,
          height: ORB_SIZE,
          borderRadius: ORB_SIZE / 2,
          overflow: 'hidden',
          transform: [{ scale: orbScale }, { rotate: spin }],
          shadowColor: '#7B2FFF',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 30,
          elevation: 20,
        }}
      >
        <LinearGradient
          colors={['#7B2FFF', '#00CFFF', '#FF6B9D', '#7B2FFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: ORB_SIZE / 2,
          }}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.4)', 'rgba(255,255,255,0)']}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 0.6 }}
          style={{
            position: 'absolute',
            top: '8%',
            left: '10%',
            width: '55%',
            height: '42%',
            borderRadius: ORB_SIZE / 2,
          }}
        />
      </Animated.View>

      {/* Timer */}
      <Text
        style={{
          fontSize: 36,
          fontWeight: '300',
          color: '#FAF8F3',
          letterSpacing: 4,
        }}
      >
        00:47
      </Text>
    </View>
  );
}
