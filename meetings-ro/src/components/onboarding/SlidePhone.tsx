import React, { useRef, useEffect } from 'react';
import { View, Text, Image, Animated, Easing, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const PHONE_WIDTH = width * 0.52;
const PHONE_HEIGHT = PHONE_WIDTH * 2.16;

export default function SlidePhone() {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -16,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.phoneWrapper, {
      transform: [{ translateY: floatAnim }],
    }]}>
      {/* Umbră dinamică sub telefon */}
      <Animated.View style={[styles.shadow, {
        transform: [{ scaleX: floatAnim.interpolate({
          inputRange: [-16, 0],
          outputRange: [0.7, 1],
        }) }],
        opacity: floatAnim.interpolate({
          inputRange: [-16, 0],
          outputRange: [0.3, 0.6],
        }),
      }]} />

      {/* iPhone frame */}
      <Image
        source={require('../../../assets/onboarding/phone_mockup.png')}
        style={styles.phone}
        resizeMode="contain"
      />

      {/* App preview pe ecranul telefonului */}
      <View style={styles.appPreview}>
        {/* Header */}
        <View style={styles.previewHeader}>
          <Text style={styles.previewLogo}>Meetings.ro</Text>
        </View>
        {/* Greeting */}
        <Text style={styles.previewGreeting}>Salut, Vlad</Text>
        <Text style={styles.previewSub}>Ce ședință înregistrezi azi?</Text>
        {/* Record button */}
        <View style={styles.previewButton}>
          <Text style={styles.previewButtonText}>⏺ Înregistrează</Text>
        </View>
      </View>
    </Animated.View>
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
  },
  appPreview: {
    position: 'absolute',
    top: '12%',
    left: '8%',
    right: '8%',
    bottom: '8%',
    backgroundColor: '#FAF8F3',
    borderRadius: 12,
    padding: 8,
    overflow: 'hidden',
  },
  previewHeader: {
    backgroundColor: '#FAF8F3',
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E0DDD6',
  },
  previewLogo: {
    fontSize: 7,
    fontWeight: '600',
    color: '#1B2A4A',
  },
  previewGreeting: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1B2A4A',
    marginTop: 6,
  },
  previewSub: {
    fontSize: 6,
    color: '#888',
    marginTop: 2,
  },
  previewButton: {
    backgroundColor: '#1B2A4A',
    borderRadius: 6,
    padding: 5,
    marginTop: 8,
    alignItems: 'center',
  },
  previewButtonText: {
    fontSize: 6,
    color: '#FAF8F3',
    fontWeight: '600',
  },
  shadow: {
    position: 'absolute',
    bottom: -20,
    width: PHONE_WIDTH * 0.7,
    height: 20,
    backgroundColor: '#7B2FFF',
    borderRadius: 50,
    opacity: 0.4,
  },
});
