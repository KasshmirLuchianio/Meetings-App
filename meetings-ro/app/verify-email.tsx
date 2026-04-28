import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useAuth } from '../src/context/AuthContext';
import { authenticatedFetch } from '../src/utils/authenticatedFetch';
import { API_BASE_URL } from '../src/constants/config';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { user, refreshUser, logout } = useAuth();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If verification status flips to true (manual refresh OR deep-link callback),
  // bounce to the home tab.
  useEffect(() => {
    if (user?.email_verified) {
      router.replace('/');
    }
  }, [user?.email_verified]);

  // Listen for the meetingsro://email-verified deep link the backend redirects to
  // after the user clicks the confirmation link in their email.
  useEffect(() => {
    const sub = Linking.addEventListener('url', (event) => {
      try {
        const parsed = Linking.parse(event.url);
        if (parsed.hostname === 'email-verified' || parsed.path === 'email-verified') {
          // The deep link tells us verification succeeded — refresh to confirm
          refreshUser();
        }
      } catch {
        // ignore
      }
    });
    return () => sub.remove();
  }, []);

  const handleResend = async () => {
    setResending(true);
    setError(null);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/resend-verification`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || 'Eroare la retrimitere');
      }
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch (e: any) {
      setError(e?.message || 'Eroare la retrimitere');
    } finally {
      setResending(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await refreshUser();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={s.container}>
      <View style={s.iconContainer}>
        <Text style={s.icon}>✉️</Text>
      </View>

      <Text style={s.title}>Verifică-ți emailul</Text>
      <Text style={s.subtitle}>
        Am trimis un link de verificare la{'\n'}
        <Text style={s.email}>{user?.email}</Text>
      </Text>

      <Text style={s.instruction}>
        Deschide emailul și apasă pe link pentru a-ți activa contul.
        Verifică și folderul Spam dacă nu îl găsești.
      </Text>

      {error ? <Text style={s.errorText}>{error}</Text> : null}

      <TouchableOpacity style={s.primaryButton} onPress={handleRefresh} disabled={refreshing}>
        {refreshing
          ? <ActivityIndicator size="small" color="#FAF8F3" />
          : <Text style={s.primaryButtonText}>Am verificat — continuă</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={s.secondaryButton}
        onPress={handleResend}
        disabled={resending || resent}
      >
        {resending ? (
          <ActivityIndicator size="small" color="#1B2A4A" />
        ) : (
          <Text style={s.secondaryButtonText}>
            {resent ? '✓ Email retrimis' : 'Retrimite emailul'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={s.logoutButton} onPress={logout}>
        <Text style={s.logoutText}>Folosește alt cont</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F3',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0EDE8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  icon: { fontSize: 36 },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1B2A4A',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B6560',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  email: {
    color: '#1B2A4A',
    fontWeight: '600',
  },
  instruction: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#1B2A4A',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FAF8F3',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1B2A4A',
    fontSize: 14,
  },
  logoutButton: {
    marginTop: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  logoutText: {
    color: '#9CA3AF',
    fontSize: 13,
  },
});
