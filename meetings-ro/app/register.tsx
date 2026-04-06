import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, User, Mail, Lock, Eye, EyeOff, Building2, Check, X } from 'lucide-react-native';
import { COLORS } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Live password validation
  const passwordChecks = useMemo(() => ({
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  }), [password]);

  const allPasswordValid = passwordChecks.length && passwordChecks.uppercase && passwordChecks.digit && passwordChecks.symbol;

  const handleRegister = async () => {
    if (name.trim().length < 2) {
      setError('Numele trebuie să aibă minim 2 caractere');
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setError('Email invalid');
      return;
    }
    if (!allPasswordValid) {
      setError('Parola nu îndeplinește toate cerințele');
      return;
    }

    setError('');
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await register(name.trim(), email.trim(), password, company.trim() || undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/');
    } catch (err: any) {
      setError(err.message || 'Eroare la înregistrare. Încearcă din nou.');
    } finally {
      setIsLoading(false);
    }
  };

  const PasswordRule = ({ met, label }: { met: boolean; label: string }) => (
    <View className="flex-row items-center gap-1.5 mt-1">
      {met ? (
        <Check size={12} color="#22C55E" />
      ) : (
        <X size={12} color="#EF4444" />
      )}
      <Text className={`font-body text-xs ${met ? 'text-green-600' : 'text-gray-400'}`}>
        {label}
      </Text>
    </View>
  );

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

      <ScrollView className="flex-1" contentContainerClassName="px-8 pb-8" keyboardShouldPersistTaps="handled">
        <Text className="text-navy text-3xl font-heading mb-2">Creează cont</Text>
        <Text className="text-gray-500 font-body text-base mb-8">
          Începe cu 5 întâlniri gratuite pe lună
        </Text>

        {error ? (
          <View className="bg-red-50 rounded-xl p-3 mb-4">
            <Text className="text-red-600 font-body text-sm text-center">{error}</Text>
          </View>
        ) : null}

        {/* Name */}
        <View className="mb-4">
          <Text className="text-navy font-body text-sm mb-2 font-medium">Nume complet *</Text>
          <View className="flex-row items-center bg-white rounded-xl border border-gray-200 px-4 h-14">
            <User size={18} color="#9CA3AF" />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ion Popescu"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
              className="flex-1 ml-3 text-navy font-body text-base"
            />
          </View>
        </View>

        {/* Email */}
        <View className="mb-4">
          <Text className="text-navy font-body text-sm mb-2 font-medium">Email *</Text>
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

        {/* Company (optional) */}
        <View className="mb-4">
          <Text className="text-navy font-body text-sm mb-2 font-medium">Companie</Text>
          <View className="flex-row items-center bg-white rounded-xl border border-gray-200 px-4 h-14">
            <Building2 size={18} color="#9CA3AF" />
            <TextInput
              value={company}
              onChangeText={setCompany}
              placeholder="Opțional"
              placeholderTextColor="#9CA3AF"
              className="flex-1 ml-3 text-navy font-body text-base"
            />
          </View>
        </View>

        {/* Password */}
        <View className="mb-4">
          <Text className="text-navy font-body text-sm mb-2 font-medium">Parolă *</Text>
          <View className="flex-row items-center bg-white rounded-xl border border-gray-200 px-4 h-14">
            <Lock size={18} color="#9CA3AF" />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Minim 8 caractere"
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
          {/* Live password requirements */}
          {password.length > 0 && (
            <View className="mt-2 ml-1">
              <PasswordRule met={passwordChecks.length} label="Minim 8 caractere" />
              <PasswordRule met={passwordChecks.uppercase} label="O literă mare (A-Z)" />
              <PasswordRule met={passwordChecks.digit} label="O cifră (0-9)" />
              <PasswordRule met={passwordChecks.symbol} label="Un simbol (!@#$%^&*)" />
            </View>
          )}
        </View>

        {/* Register Button */}
        <Pressable
          onPress={handleRegister}
          disabled={isLoading}
          className="bg-navy h-14 rounded-xl items-center justify-center active:opacity-90 mt-4"
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-heading text-base">Creează cont gratuit</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.push('/login')}
          className="mt-6 items-center"
        >
          <Text className="text-gray-500 font-body text-sm">
            Ai deja cont? <Text className="text-navy font-medium">Conectează-te</Text>
          </Text>
        </Pressable>

        {/* Terms */}
        <Text className="text-gray-400 font-body text-xs text-center mt-6 leading-5">
          Prin crearea contului, accepți{' '}
          <Text
            className="text-navy underline"
            onPress={() => Linking.openURL('https://meetings-ro-api.onrender.com/terms')}
          >
            Termenii și Condițiile
          </Text>
          {' '}și{' '}
          <Text
            className="text-navy underline"
            onPress={() => Linking.openURL('https://meetings-ro-api.onrender.com/privacy')}
          >
            Politica de Confidențialitate
          </Text>
        </Text>
      </ScrollView>

    </KeyboardAvoidingView>
  );
}
