import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Mail, Lock, Eye, EyeOff, KeyRound } from 'lucide-react-native';
import { COLORS } from '../src/constants/theme';
import { API_BASE_URL } from '../src/constants/config';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSendCode = async () => {
    if (!email.trim()) {
      setError('Introdu adresa de email');
      return;
    }
    setError('');
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) {
        setStep('reset');
        setSuccess('Verifică inbox-ul pentru codul de resetare.');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || 'Eroare la trimitere.');
      }
    } catch {
      setError('Eroare de rețea. Încearcă din nou.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!code.trim() || !newPassword.trim()) {
      setError('Completează toate câmpurile');
      return;
    }
    if (newPassword.length < 6) {
      setError('Parola trebuie să aibă minim 6 caractere');
      return;
    }
    setError('');
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: code.trim(), new_password: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSuccess('Parola a fost resetată! Te poți autentifica.');
        setTimeout(() => router.replace('/login'), 2000);
      } else {
        setError(data.detail || 'Cod invalid sau expirat.');
      }
    } catch {
      setError('Eroare de rețea. Încearcă din nou.');
    } finally {
      setIsLoading(false);
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
        <Text className="text-navy text-3xl font-heading mb-2">
          {step === 'email' ? 'Resetare parolă' : 'Parolă nouă'}
        </Text>
        <Text className="text-gray-500 font-body text-base mb-10">
          {step === 'email'
            ? 'Introdu emailul și îți trimitem un cod de resetare.'
            : 'Introdu codul primit pe email și parola nouă.'}
        </Text>

        {error ? (
          <View className="bg-red-50 rounded-xl p-3 mb-4">
            <Text className="text-red-600 font-body text-sm text-center">{error}</Text>
          </View>
        ) : null}

        {success ? (
          <View className="bg-green-50 rounded-xl p-3 mb-4">
            <Text className="text-green-600 font-body text-sm text-center">{success}</Text>
          </View>
        ) : null}

        {step === 'email' ? (
          <>
            {/* Email */}
            <View className="mb-6">
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

            <Pressable
              onPress={handleSendCode}
              disabled={isLoading}
              className="bg-navy h-14 rounded-xl items-center justify-center active:opacity-90"
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-heading text-base">Trimite codul</Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            {/* Code */}
            <View className="mb-4">
              <Text className="text-navy font-body text-sm mb-2 font-medium">Cod de resetare</Text>
              <View className="flex-row items-center bg-white rounded-xl border border-gray-200 px-4 h-14">
                <KeyRound size={18} color="#9CA3AF" />
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder="Codul din email"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="flex-1 ml-3 text-navy font-body text-base"
                />
              </View>
            </View>

            {/* New password */}
            <View className="mb-6">
              <Text className="text-navy font-body text-sm mb-2 font-medium">Parolă nouă</Text>
              <View className="flex-row items-center bg-white rounded-xl border border-gray-200 px-4 h-14">
                <Lock size={18} color="#9CA3AF" />
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Minim 6 caractere"
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

            <Pressable
              onPress={handleResetPassword}
              disabled={isLoading}
              className="bg-navy h-14 rounded-xl items-center justify-center active:opacity-90"
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-heading text-base">Resetează parola</Text>
              )}
            </Pressable>
          </>
        )}

        <Pressable
          onPress={() => router.push('/login')}
          className="mt-6 items-center"
        >
          <Text className="text-gray-500 font-body text-sm">
            Îți amintești parola? <Text className="text-navy font-medium">Conectare</Text>
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
