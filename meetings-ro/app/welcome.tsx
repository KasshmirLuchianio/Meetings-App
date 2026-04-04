import React from 'react';
import { View, Text, Pressable, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Mic, ArrowRight, Shield, Zap } from 'lucide-react-native';
import { COLORS } from '../src/constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/register');
  };

  const handleLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/login');
  };

  return (
    <View className="flex-1 bg-ivory" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <StatusBar barStyle="dark-content" />

      {/* Hero */}
      <View className="flex-1 justify-center items-center px-8">
        {/* Logo */}
        <View className="w-20 h-20 bg-navy rounded-2xl items-center justify-center mb-8">
          <Mic size={40} color="#FAF8F3" />
        </View>

        <Text className="text-navy text-4xl font-heading text-center mb-3">
          Meetings.ro
        </Text>
        <Text className="text-gray-500 text-base font-body text-center mb-12 leading-6">
          Platformă inteligentă de transcriere{'\n'}și sinteză AI pentru afaceri
        </Text>

        {/* Features */}
        <View className="w-full gap-4 mb-12">
          <View className="flex-row items-center gap-4 bg-white rounded-xl p-4">
            <View className="w-10 h-10 bg-navy/10 rounded-lg items-center justify-center">
              <Mic size={20} color={COLORS.navy} />
            </View>
            <View className="flex-1">
              <Text className="text-navy font-heading text-sm">Înregistrare & Transcriere</Text>
              <Text className="text-gray-500 font-body text-xs">Audio în text, automat în română</Text>
            </View>
          </View>

          <View className="flex-row items-center gap-4 bg-white rounded-xl p-4">
            <View className="w-10 h-10 bg-navy/10 rounded-lg items-center justify-center">
              <Zap size={20} color={COLORS.navy} />
            </View>
            <View className="flex-1">
              <Text className="text-navy font-heading text-sm">Sinteză AI pe domeniu</Text>
              <Text className="text-gray-500 font-body text-xs">Banking, Legal, Sănătate, Startups</Text>
            </View>
          </View>

          <View className="flex-row items-center gap-4 bg-white rounded-xl p-4">
            <View className="w-10 h-10 bg-navy/10 rounded-lg items-center justify-center">
              <Shield size={20} color={COLORS.navy} />
            </View>
            <View className="flex-1">
              <Text className="text-navy font-heading text-sm">Securitate enterprise</Text>
              <Text className="text-gray-500 font-body text-xs">Date criptate, GDPR compliant</Text>
            </View>
          </View>
        </View>
      </View>

      {/* CTA Buttons */}
      <View className="px-8 pb-4 gap-3">
        <Pressable
          onPress={handleGetStarted}
          className="bg-navy h-14 rounded-xl items-center justify-center flex-row gap-2 active:opacity-90"
        >
          <Text className="text-white font-heading text-base">Începe gratuit</Text>
          <ArrowRight size={20} color="white" />
        </Pressable>

        <Pressable
          onPress={handleLogin}
          className="h-14 rounded-xl items-center justify-center active:bg-navy/5"
        >
          <Text className="text-navy font-body text-base">Am deja un cont</Text>
        </Pressable>
      </View>
    </View>
  );
}
