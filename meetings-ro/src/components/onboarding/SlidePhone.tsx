import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, Image, Easing, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const PHONE_WIDTH = width * 0.48;
const PHONE_HEIGHT = PHONE_WIDTH * 2.16;

// Screen area inside the phone PNG
const SCREEN_WIDTH = PHONE_WIDTH * 0.74;
const SCREEN_HEIGHT = PHONE_HEIGHT * 0.82;
const SCREEN_TOP = PHONE_HEIGHT * 0.08;
const SCREEN_LEFT = (PHONE_WIDTH - SCREEN_WIDTH) / 2;

// Orb sized to 60% of screen width
const ORB_SIZE = SCREEN_WIDTH * 0.60;

export default function SlidePhone() {
  const orbScale = useRef(new Animated.Value(1)).current;
  const orbRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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

  return (
    <View style={styles.phoneWrapper}>
      {/* iPhone frame (on top, z-index 2) */}
      <Image
        source={require('../../../assets/onboarding/phone_mockup.png')}
        style={styles.phone}
        resizeMode="contain"
      />

      {/* Screen content — clipped to phone screen area */}
      <View style={styles.screen}>
        {/* Orb centered */}
        <View style={styles.orbContainer}>
          <Animated.View style={{
            width: ORB_SIZE,
            height: ORB_SIZE,
            borderRadius: ORB_SIZE / 2,
            overflow: 'hidden',
            transform: [{ scale: orbScale }, { rotate: spin }],
            shadowColor: '#7B2FFF',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 40,
            elevation: 20,
          }}>
            <LinearGradient
              colors={['#7B2FFF', '#00CFFF', '#FF6B9D', '#7B2FFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: '100%', height: '100%', borderRadius: ORB_SIZE / 2 }}
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 0.6 }}
              style={{
                position: 'absolute',
                top: '8%', left: '10%',
                width: '60%', height: '45%',
                borderRadius: ORB_SIZE / 2,
              }}
            />
          </Animated.View>
        </View>

        {/* Timer */}
        <Text style={styles.timer}>00:47</Text>

        {/* Hint */}
        <Text style={styles.hint}>Vorbește clar și natural</Text>

        {/* Stop button */}
        <View style={styles.stopButton}>
          <View style={styles.stopSquare} />
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
    alignSelf: 'center',
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
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#050508',
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  orbContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timer: {
    position: 'absolute',
    bottom: '22%',
    fontSize: 18,
    fontWeight: '300',
    color: '#FAF8F3',
    letterSpacing: 3,
  },
  hint: {
    position: 'absolute',
    bottom: '16%',
    fontSize: 7,
    color: 'rgba(250,248,243,0.4)',
    letterSpacing: 1,
  },
  stopButton: {
    position: 'absolute',
    bottom: '6%',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(250,248,243,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(250,248,243,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopSquare: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#FAF8F3',
  },
});
