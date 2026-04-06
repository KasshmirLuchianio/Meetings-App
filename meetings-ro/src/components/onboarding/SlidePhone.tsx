import React, { useRef, useEffect } from 'react';
import { View, Text, Image, Animated, Easing, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHONE_WIDTH = SCREEN_WIDTH * 0.52;
const PHONE_HEIGHT = PHONE_WIDTH * 2.16;

// Real iPhone screen dimensions for scaling
const REAL_SCREEN_W = 390;
const REAL_SCREEN_H = 844;

// Phone screen area (inside bezels)
const SCREEN_LEFT = PHONE_WIDTH * 0.08;
const SCREEN_TOP = PHONE_HEIGHT * 0.12;
const SCREEN_INNER_W = PHONE_WIDTH * 0.84;
const SCREEN_INNER_H = PHONE_HEIGHT * 0.80;

const SCALE = SCREEN_INNER_W / REAL_SCREEN_W;

export default function SlidePhone() {
  const orbScale = useRef(new Animated.Value(1)).current;
  const orbRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Orb pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbScale, {
          toValue: 1.08,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(orbScale, {
          toValue: 0.96,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Orb rotation
    Animated.loop(
      Animated.timing(orbRotation, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = orbRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Manual transform origin compensation (top-left)
  const offsetX = -(REAL_SCREEN_W * (1 - SCALE)) / 2;
  const offsetY = -(REAL_SCREEN_H * (1 - SCALE)) / 2;

  return (
    <View style={styles.phoneWrapper}>

      {/* iPhone frame */}
      <Image
        source={require('../../../assets/onboarding/phone_mockup.png')}
        style={styles.phone}
        resizeMode="contain"
      />

      {/* Screen content — miniaturized RecordingScreen */}
      <View style={styles.screen}>
        <View style={{
          width: REAL_SCREEN_W,
          height: REAL_SCREEN_H,
          transform: [
            { scale: SCALE },
            { translateX: offsetX },
            { translateY: offsetY },
          ],
          backgroundColor: '#050508',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* Orb — exact RecordingScreen */}
          <Animated.View style={{
            width: 292,
            height: 292,
            borderRadius: 146,
            overflow: 'hidden',
            transform: [{ scale: orbScale }, { rotate: spin }],
            shadowColor: '#7B2FFF',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 60,
            elevation: 30,
            marginBottom: 32,
          }}>
            <LinearGradient
              colors={['#7B2FFF', '#00CFFF', '#FF6B9D', '#7B2FFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: '100%', height: '100%', borderRadius: 146 }}
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 0.6 }}
              style={{
                position: 'absolute',
                top: '8%', left: '10%',
                width: '60%', height: '45%',
                borderRadius: 146,
              }}
            />
          </Animated.View>

          {/* Timer */}
          <Text style={{
            fontSize: 48,
            fontWeight: '300',
            color: '#FAF8F3',
            letterSpacing: 4,
            marginBottom: 12,
          }}>00:47</Text>

          {/* Hint */}
          <Text style={{
            fontSize: 14,
            color: 'rgba(250,248,243,0.4)',
            letterSpacing: 1,
            marginBottom: 32,
          }}>Vorbește clar și natural</Text>

          {/* Stop button */}
          <View style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: 'rgba(250,248,243,0.1)',
            borderWidth: 1,
            borderColor: 'rgba(250,248,243,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <View style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              backgroundColor: '#FAF8F3',
            }} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  phoneWrapper: {
    width: PHONE_WIDTH,
    height: PHONE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phone: {
    width: PHONE_WIDTH,
    height: PHONE_HEIGHT,
    position: 'absolute',
    zIndex: 2,
  },
  screen: {
    position: 'absolute',
    top: SCREEN_TOP,
    left: SCREEN_LEFT,
    width: SCREEN_INNER_W,
    height: SCREEN_INNER_H,
    overflow: 'hidden',
    borderRadius: 10,
    zIndex: 1,
  },
});
