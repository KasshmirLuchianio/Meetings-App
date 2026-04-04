import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, Redirect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import TopBar from '../src/components/TopBar';
import AudioRecorder from '../src/components/AudioRecorder';
import AudioUploader from '../src/components/AudioUploader';
import { Mic, Upload, ChevronRight, Crown } from 'lucide-react-native';
import { COLORS } from '../src/constants/theme';
import { API_BASE_URL, PRICING_PLANS } from '../src/constants/config';
import { useAuth } from '../src/context/AuthContext';

const STORAGE_KEY = 'selected_vertical';

const VERTICAL_LABELS: Record<string, string> = {
  GAL: '🏛️ GAL',
  JOURNALISM: '📰 Jurnalism',
  LEGAL: '⚖️ Legal',
  BANKING: '🏦 Banking',
  HEALTHCARE: '🏥 Sănătate',
  STARTUPS: '🚀 Startups',
};

export default function HomeScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'record' | 'upload'>('record');
  const [verticalType, setVerticalType] = useState<string>('GAL');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved) setVerticalType(saved);
    }).catch(() => {});
  }, []);

  if (isLoading) {
    return (
      <View className="flex-1 bg-ivory items-center justify-center">
        <ActivityIndicator size="large" color={COLORS.navy} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/welcome" />;
  }

  const currentPlan = PRICING_PLANS.find((p) => p.tier === user?.plan) || PRICING_PLANS[0];
  const meetingsLeft = currentPlan.meetings_per_month
    ? currentPlan.meetings_per_month - (user?.meetings_used_this_month || 0)
    : null;

  const handleRecordingComplete = async (uri: string, duration: number) => {
    try {
      const createRes = await fetch(`${API_BASE_URL}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vertical_type: verticalType }),
      });
      if (!createRes.ok) throw new Error('Failed to create meeting');
      const meeting = await createRes.json();

      const formData = new FormData();
      formData.append('file', {
        uri,
        type: 'audio/m4a',
        name: `recording_${Date.now()}.m4a`,
      } as any);

      const uploadRes = await fetch(`${API_BASE_URL}/api/meetings/${meeting._id}/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!uploadRes.ok) throw new Error('Failed to upload');
      router.push(`/meeting/${meeting._id}`);
    } catch {
      alert('Eroare la încărcarea înregistrării');
    }
  };

  const handleUploadComplete = (meetingId: string) => {
    router.push(`/meeting/${meetingId}`);
  };

  const handleTabChange = (tab: 'record' | 'upload') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  };

  return (
    <View className="flex-1 bg-ivory">
      <TopBar />

      <ScrollView className="flex-1" contentContainerClassName="px-4 py-5">
        {/* Greeting */}
        <View className="mb-5">
          <Text className="text-navy text-2xl font-heading">
            Salut, {user?.name?.split(' ')[0] || 'Utilizator'}
          </Text>
          <Text className="text-gray-500 font-body text-sm mt-1">
            Ce ședință vrei să înregistrezi astăzi?
          </Text>
        </View>

        {/* Usage Card */}
        <View className="bg-white rounded-2xl p-4 mb-5 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 bg-navy/10 rounded-lg items-center justify-center">
              <Crown size={18} color={COLORS.navy} />
            </View>
            <View>
              <Text className="text-navy font-heading text-sm">{currentPlan.name}</Text>
              <Text className="text-gray-500 font-body text-xs">
                {meetingsLeft !== null
                  ? `${meetingsLeft} întâlniri rămase luna aceasta`
                  : 'Întâlniri nelimitate'}
              </Text>
            </View>
          </View>
          {user?.plan === 'FREE' && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/pricing');
              }}
              className="bg-gold/15 rounded-lg px-3 py-1.5"
            >
              <Text className="text-gold font-body text-xs font-medium">Upgrade</Text>
            </Pressable>
          )}
        </View>

        {/* Tabs */}
        <View className="flex-row bg-white rounded-xl p-1 mb-5">
          <Pressable
            onPress={() => handleTabChange('record')}
            className={`flex-1 h-12 rounded-lg items-center justify-center flex-row gap-2 ${
              activeTab === 'record' ? 'bg-navy' : 'bg-transparent'
            }`}
          >
            <Mic size={18} color={activeTab === 'record' ? 'white' : COLORS.navy} />
            <Text
              className={`font-heading text-sm ${
                activeTab === 'record' ? 'text-white' : 'text-navy'
              }`}
            >
              Înregistrează
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleTabChange('upload')}
            className={`flex-1 h-12 rounded-lg items-center justify-center flex-row gap-2 ${
              activeTab === 'upload' ? 'bg-navy' : 'bg-transparent'
            }`}
          >
            <Upload size={18} color={activeTab === 'upload' ? 'white' : COLORS.navy} />
            <Text
              className={`font-heading text-sm ${
                activeTab === 'upload' ? 'text-white' : 'text-navy'
              }`}
            >
              Încarcă audio
            </Text>
          </Pressable>
        </View>

        {/* Content */}
        <View className="bg-white rounded-2xl p-6">
          {activeTab === 'record' ? (
            <View className="items-center py-6">
              <Text className="text-navy text-2xl font-heading mb-2 text-center">
                Înregistrare nouă
              </Text>
              <Text className="text-gray-500 text-sm font-body mb-8 text-center">
                Înregistrează ședința live cu un singur tap
              </Text>
              <AudioRecorder onRecordingComplete={handleRecordingComplete} />
            </View>
          ) : (
            <AudioUploader
              onUploadComplete={handleUploadComplete}
              verticalType={verticalType}
            />
          )}
        </View>

        {/* Vertical Selector Quick */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.navigate('/onboarding');
          }}
          className="mt-4 p-4 bg-white rounded-xl flex-row items-center justify-between active:bg-gray-50"
        >
          <View>
            <Text className="text-navy text-sm font-heading mb-0.5">
              Domeniu: {VERTICAL_LABELS[verticalType] || verticalType}
            </Text>
            <Text className="text-gray-500 text-xs font-body">
              Apasă pentru a schimba verticala
            </Text>
          </View>
          <ChevronRight size={18} color="#9CA3AF" />
        </Pressable>
      </ScrollView>
    </View>
  );
}
