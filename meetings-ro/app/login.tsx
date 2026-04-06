import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Mail, Lock, Eye, EyeOff, RefreshCw } from 'lucide-react-native';
import { COLORS } from '../src/constants/theme';
import { API_BASE_URL } from '../src/constants/config';
import { useAuth } from '../src/context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ verificationSent?: string }>();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(params.verificationSent === '1');
  const [resendMessage, setResendMessage] = useState(
    params.verificationSent === '1' ? 'Cont creat! Verifică inbox-ul pentru emailul de confirmare.' : ''
  );

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Completează toate câmpurile');
      return;
    }
    setError('');
    setNeedsVerification(false);
    setResendMessage('');
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await login(email.trim(), password);
      router.replace('/');
    } catch (err: any) {
      if (err.message === 'email_not_verified') {
        setNeedsVerification(true);
        setError('Confirmă adresa de email înainte de a te autentifica. Verifică inbox-ul.');
      } else {
        setError(err.message || 'Email sau parolă incorectă');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim()) {
      setResendMessage('Introdu adresa de email mai întâi.');
      return;
    }
    setIsResending(true);
    setResendMessage('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setResendMessage(data.message || 'Email retrimis!');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setResendMessage(data.detail || 'Eroare la retrimitere.');
      }
    } catch {
      setResendMessage('Eroare de rețea. Încearcă din nou.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-ivory"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {/* Header */}
      <View className="flex-row items-center px-4 h-14">
        <Pressable
          onPress={() => router.back()}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-navy/10"
        >
          <ArrowLeft size={24} stroke={COLORS.navy} />
        </Pressable>
      </View>

      <View className="flex-1 px-8 justify-center">
        <Text className="text-navy text-3xl font-heading mb-2">Bine ai revenit</Text>
        <Text className="text-gray-500 font-body text-base mb-10">
          Conectează-te la contul tău Meetings.ro
        </Text>

        {error ? (
          <View className="bg-red-50 rounded-xl p-3 mb-4">
            <Text className="text-red-600 font-body text-sm text-center">{error}</Text>
          </View>
        ) : null}

        {/* Email */}
        <View className="mb-4">
          <Text className="text-navy font-body text-sm mb-2 font-medium">Email</Text>
          <View className="flex-row items-center bg-white rounded-xl border border-gray-200 px-4 h-14">
            <Mail size={18} color="#9CA3AF" />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="email@companie.ro"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              className="flex-1 ml-3 text-navy font-body text-base"
            />
          </View>
        </View>

        {/* Password */}
        <View className="mb-6">
          <Text className="text-navy font-body text-sm mb-2 font-medium">Parolă</Text>
          <View className="flex-row items-center bg-white rounded-xl border border-gray-200 px-4 h-14">
            <Lock size={18} color="#9CA3AF" />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPassword}
              className="flex-1 ml-3 text-navy font-body text-base"
            />
            <Pressable onPress={() => setShowPassword(!showPassword)}>
              {showPassword ? (
                <EyeOff size={18} color="#9CA3AF" />
              ) : (
                <Eye size={18} color="#9CA3AF" />
              )}
            </Pressable>
          </View>
        </View>

        {/* Forgot Password */}
        <Pressable
          onPress={() => router.push('/forgot-password')}
          className="mb-4 items-end"
        >
          <Text className="text-navy font-body text-sm font-medium">Ai uitat parola?</Text>
        </Pressable>

        {/* Resend verification — only after 403 email_not_verified */}
        {needsVerification && (
          <View className="mb-4">
            <Pressable
              onPress={handleResendVerification}
              disabled={isResending || !email.trim()}
              className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex-row items-center justify-center gap-2"
            >
              {isResending ? (
                <ActivityIndicator size="small" color={COLORS.navy} />
              ) : (
                <RefreshCw size={16} color={COLORS.navy} />
              )}
              <Text className="text-navy font-body text-sm font-medium">
                Retrimite email de confirmare
              </Text>
            </Pressable>
            {resendMessage ? (
              <Text className="text-green-600 font-body text-xs text-center mt-2">{resendMessage}</Text>
            ) : null}
          </View>
        )}

        {/* Login Button */}
        <Pressable
          onPress={handleLogin}
          disabled={isLoading}
          className="bg-navy h-14 rounded-xl items-center justify-center active:opacity-90"
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-heading text-base">Conectare</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.push('/register')}
          className="mt-6 items-center"
        >
          <Text className="text-gray-500 font-body text-sm">
            Nu ai cont? <Text className="text-navy font-medium">Creează unul</Text>
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
