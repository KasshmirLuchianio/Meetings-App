import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions,
  TouchableOpacity, Animated, Easing, StatusBar, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import SlidePhone from './onboarding/SlidePhone';
import SlideWaveform from './onboarding/SlideWaveform';
import SlideMic from './onboarding/SlideMic';
import SlideShield from './onboarding/SlideShield';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: 1,
    component: SlidePhone,
    welcome: 'BUN VENIT LA MEETINGS.RO',
    title: 'Pune telefonul pe masă',
    subtitle: 'În centrul discuției, nu în buzunar.',
    gradient: ['#000000', '#0D1B2A'] as const,
  },
  {
    id: 2,
    component: SlideWaveform,
    title: 'Fără zgomot de fundal',
    subtitle: 'TV, muzică sau boxe reduc acuratețea.',
    gradient: ['#000000', '#0D0014'] as const,
  },
  {
    id: 3,
    component: SlideMic,
    title: 'Vorbește natural',
    subtitle: 'Nu trebuie să stai aproape de telefon.',
    gradient: ['#000000', '#0D1B2A'] as const,
  },
  {
    id: 4,
    component: SlideShield,
    title: 'Gata de înregistrat',
    subtitle: 'Datele tale sunt private și securizate.',
    gradient: ['#000000', '#000D1A'] as const,
  },
];

// Apple-style platform-specific font weight for tracked uppercase eyebrows.
// SF Pro Display at 600 is perfect; Android Roboto at 600 is too dense — drop to 500.
const APPLE_EYEBROW_WEIGHT: '600' | '500' = Platform.OS === 'ios' ? '600' : '500';

// letterSpacing values for the welcome eyebrow at idle / pressed states.
const WELCOME_TRACK_IDLE = 3.5;
const WELCOME_TRACK_PRESSED = 2.6;

export default function OnboardingModal({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [currentSlide, setCurrentSlide] = useState(0);
  const bgOpacity = useRef(new Animated.Value(0)).current;

  // Welcome eyebrow has its own animation values so it can enter ~120ms BEFORE the title.
  const welcomeFade = useRef(new Animated.Value(0)).current;
  const welcomeSlide = useRef(new Animated.Value(20)).current;
  const welcomeTrack = useRef(new Animated.Value(WELCOME_TRACK_IDLE)).current;

  // Title / subtitle / dots / CTA enter as one group, delayed.
  const contentFade = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.timing(bgOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start(() => animateContent());
  }, []);

  useEffect(() => {
    animateContent();
  }, [currentSlide]);

  const animateContent = () => {
    // Reset all entrance values
    welcomeFade.setValue(0);
    welcomeSlide.setValue(20);
    contentFade.setValue(0);
    contentSlide.setValue(30);

    // 1. Welcome eyebrow enters first — softer easing, shorter duration.
    Animated.parallel([
      Animated.timing(welcomeFade, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(welcomeSlide, {
        toValue: 0,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Title + rest enter 120ms later (Apple-style deliberate stagger).
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(contentFade, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(contentSlide, {
          toValue: 0,
          tension: 70,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    }, 120);
  };

  // Press feedback: when CTA is pressed, the welcome eyebrow's tracking subtly
  // tightens — creates a sense that the whole screen "leans in" with the user.
  // letterSpacing is a layout property → must use useNativeDriver:false.
  const handlePressIn = () => {
    Animated.timing(welcomeTrack, {
      toValue: WELCOME_TRACK_PRESSED,
      duration: 140,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(welcomeTrack, {
      toValue: WELCOME_TRACK_IDLE,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const handleNext = async () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      await handleDone();
    }
  };

  const handleDone = async () => {
    Animated.timing(bgOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(async () => {
      const key = `onboarding_completed_${user?.email || user?._id || 'default'}`;
      await AsyncStorage.setItem(key, 'true');
      onDone();
    });
  };

  const slide = SLIDES[currentSlide];
  const SlideComponent = slide.component;
  const isLast = currentSlide === SLIDES.length - 1;

  return (
    <Animated.View style={[styles.overlay, { opacity: bgOpacity }]}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={slide.gradient}
        style={styles.gradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Skip button */}
      {!isLast && (
        <TouchableOpacity style={styles.skipButton} onPress={handleDone}>
          <Text style={styles.skipText}>Sari peste ▶︎</Text>
        </TouchableOpacity>
      )}

      {/* Ilustrație slide */}
      <Animated.View style={[styles.illustrationContainer, {
        opacity: contentFade,
      }]}>
        <SlideComponent />
      </Animated.View>

      {/* Text + controls */}
      <View style={styles.bottomContainer}>
        {/* Welcome eyebrow — enters FIRST, fades + slides on its own timeline.
            Animated.Text is required because letterSpacing animation needs JS driver. */}
        {'welcome' in slide && slide.welcome && (
          <Animated.View
            style={{
              opacity: welcomeFade,
              transform: [{ translateY: welcomeSlide }],
              alignSelf: 'stretch',
            }}
          >
            <Animated.Text
              style={[styles.welcome, { letterSpacing: welcomeTrack }]}
            >
              {slide.welcome}
            </Animated.Text>
          </Animated.View>
        )}

        {/* Rest of the content — enters 120ms after the welcome eyebrow */}
        <Animated.View
          style={{
            opacity: contentFade,
            transform: [{ translateY: contentSlide }],
            alignItems: 'center',
            alignSelf: 'stretch',
            gap: 16,
          }}
        >
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.subtitle}>{slide.subtitle}</Text>

          {/* Progress dots */}
          <View style={styles.dotsContainer}>
            {SLIDES.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentSlide && styles.dotActive,
                  index < currentSlide && styles.dotDone,
                ]}
              />
            ))}
          </View>

          {/* CTA Button — press feedback subtly tightens welcome tracking */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleNext}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>
              {isLast ? 'Începe' : 'Continuă'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9998,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gradient: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    backgroundColor: 'rgba(250,248,243,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  skipText: {
    color: 'rgba(250,248,243,0.6)',
    fontSize: 13,
  },
  illustrationContainer: {
    height: height * 0.55,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  bottomContainer: {
    height: height * 0.45,
    width: '100%',
    paddingHorizontal: 32,
    paddingBottom: 60,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 24,
    gap: 16,
  },
  welcome: {
    fontSize: 11,
    fontWeight: APPLE_EYEBROW_WEIGHT,  // 600 on iOS (SF Pro), 500 on Android (Roboto)
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginBottom: 14,
    // letterSpacing is animated inline via Animated.Text (idle 3.5 → pressed 2.6)
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FAF8F3',
    textAlign: 'center',
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(250,248,243,0.5)',
    textAlign: 'center',
    lineHeight: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    width: 28,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  dotDone: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#FAF8F3',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#1B2A4A',
    fontSize: 17,
    fontWeight: '600',
  },
});
