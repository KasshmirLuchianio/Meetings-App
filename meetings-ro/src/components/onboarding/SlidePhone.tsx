import React, { useRef, useEffect } from 'react';
import { View, Image, Animated, Easing, StyleSheet, Dimensions } from 'react-native';
import OrbMiniature from './OrbMiniature';

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

      {/* Orb pe ecranul telefonului — centrat pe ecran */}
      <View style={styles.orbOnScreen}>
        <OrbMiniature size={90} />
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
  orbOnScreen: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
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
