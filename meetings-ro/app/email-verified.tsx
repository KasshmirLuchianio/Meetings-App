import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../src/context/AuthContext';

/**
 * Lands here when the user clicks the verification link in their email.
 * Backend 302-redirects to meetingsro:///email-verified?status=success.
 *
 * We re-fetch the user from /api/auth/me (so context picks up the freshly
 * flipped email_verified=true) and then bounce to Home. If verification
 * actually failed/expired, /api/auth/me returns email_verified=false and
 * the Home redirect in app/index.tsx sends them back to /verify-email.
 */
export default function EmailVerifiedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const { refreshUser } = useAuth();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshUser();
      } catch {
        // ignore — Home redirect logic handles the error case
      }
      if (cancelled) return;
      if (params.status === 'success' || params.status === 'already_verified') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.replace('/');
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <View style={s.container}>
      <ActivityIndicator size="large" color="#1B2A4A" />
      <Text style={s.text}>Activăm contul tău...</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F3',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  text: {
    fontSize: 14,
    color: '#6B6560',
    fontWeight: '500',
  },
});
