import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../src/context/AuthContext';
import { authenticatedFetch } from '../src/utils/authenticatedFetch';
import { API_BASE_URL } from '../src/constants/config';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { user, refreshUser, logout } = useAuth();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  // Animations — entrance fade/slide + ambient pulse on the envelope
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Auto-redirect when verified — fires whether user clicked the email link
  // (deep link triggers refresh below) or hit the manual "I've verified" button.
  useEffect(() => {
    if (user?.email_verified) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/');
    }
  }, [user?.email_verified]);

  // Listen for the meetingsro://email-verified deep link the backend redirects
  // to after the user clicks the link in their email. Also auto-poll every 5s
  // as a fallback (covers the "user opens email on desktop" case).
  useEffect(() => {
    const sub = Linking.addEventListener('url', (event) => {
      try {
        const parsed = Linking.parse(event.url);
        if (parsed.hostname === 'email-verified' || parsed.path === 'email-verified') {
          refreshUser();
        }
      } catch {
        // ignore malformed URL
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshUser();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleResend = async () => {
    if (resending || resent) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setResending(true);
    setError('');
    try {
      const res = await authenticatedFetch(
        `${API_BASE_URL}/api/auth/resend-verification`,
        { method: 'POST' }
      );
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setResent(true);
        setTimeout(() => setResent(false), 5000);
      } else if (res.status === 429) {
        setError('Prea multe încercări. Așteaptă o oră înainte de a solicita un alt email.');
      } else {
        setError('Nu am putut retrimite emailul. Încearcă din nou.');
      }
    } catch {
      setError('Eroare de conexiune. Verifică internetul.');
    } finally {
      setResending(false);
    }
  };

  const handleCheckNow = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChecking(true);
    setError('');
    await refreshUser();
    setChecking(false);
    // Note: user state may not have updated synchronously — the auto-redirect
    // useEffect above handles the success path. Show error only if still unverified.
    setTimeout(() => {
      if (!user?.email_verified) {
        setError('Emailul nu a fost verificat încă. Verifică inbox-ul.');
        setTimeout(() => setError(''), 3000);
      }
    }, 250);
  };

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await logout();
    // /welcome is the unauthenticated landing in this app (per index.tsx Redirect)
    router.replace('/welcome');
  };

  return (
    <SafeAreaView style={s.safe}>
      <Animated.View
        style={[
          s.container,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Top — visual + heading + instructions */}
        <View style={s.topSection}>
          <Animated.View style={[s.iconWrapper, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={s.iconEmoji}>✉️</Text>
          </Animated.View>

          <Text style={s.heading}>Verifică-ți emailul</Text>
          <Text style={s.subheading}>Am trimis un link de activare la</Text>
          <Text style={s.email}>{user?.email}</Text>

          <View style={s.instructionCard}>
            <Text style={s.instructionText}>
              1. Deschide aplicația de email{'\n'}
              2. Caută un email de la <Text style={s.bold}>noreply@meetings-ro.app</Text>{'\n'}
              3. Apasă pe <Text style={s.bold}>"Verifică adresa de email"</Text>
            </Text>
          </View>
        </View>

        {/* Bottom — actions */}
        <View style={s.bottomSection}>
          {error ? <Text style={s.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[s.primaryButton, checking && s.buttonDisabled]}
            onPress={handleCheckNow}
            activeOpacity={0.8}
            disabled={checking}
          >
            <Text style={s.primaryButtonText}>
              {checking ? 'Se verifică...' : 'Am verificat — continuă ›'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.secondaryButton}
            onPress={handleResend}
            disabled={resending || resent}
            activeOpacity={0.7}
          >
            <Text style={[s.secondaryButtonText, resent && s.secondaryButtonSuccess]}>
              {resending
                ? 'Se trimite...'
                : resent
                ? '✓ Email retrimis cu succes'
                : 'Nu ai primit emailul? Retrimite'}
            </Text>
          </TouchableOpacity>

          <Text style={s.spamNote}>
            Verifică și folderul Spam sau Junk dacă nu găsești emailul.
          </Text>

          <TouchableOpacity style={s.logoutButton} onPress={handleLogout}>
            <Text style={s.logoutText}>Folosește alt cont</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAF8F3',
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
    paddingBottom: Platform.OS === 'ios' ? 8 : 24,
  },
  topSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  iconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F0EDE8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: '#1B2A4A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  iconEmoji: { fontSize: 42 },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1B2A4A',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 15,
    color: '#6B6560',
    textAlign: 'center',
    marginBottom: 4,
  },
  email: {
    fontSize: 15,
    color: '#1B2A4A',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 28,
  },
  instructionCard: {
    backgroundColor: '#F0EDE8',
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  instructionText: {
    fontSize: 14,
    color: '#4A5568',
    lineHeight: 22,
  },
  bold: {
    fontWeight: '600',
    color: '#1B2A4A',
  },
  bottomSection: {
    paddingBottom: 8,
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#CC3333',
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#1B2A4A',
    borderRadius: 14,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#1B2A4A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: {
    color: '#FAF8F3',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#1B2A4A',
    fontSize: 14,
    fontWeight: '500',
  },
  secondaryButtonSuccess: { color: '#2D7A4F' },
  spamNote: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  logoutText: {
    fontSize: 13,
    color: '#9CA3AF',
    textDecorationLine: 'underline',
  },
});
