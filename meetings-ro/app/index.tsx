import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, Redirect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import TopBar from '../src/components/TopBar';
import AudioRecorder from '../src/components/AudioRecorder';
import AudioUploader from '../src/components/AudioUploader';
import OnboardingModal from '../src/components/OnboardingModal';
import { Mic, Upload, ChevronRight, Crown, AlertTriangle } from 'lucide-react-native';
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
  const { isAuthenticated, isLoading, user, token, refreshUsage } = useAuth();
  const [activeTab, setActiveTab] = useState<'record' | 'upload'>('record');
  const [verticalType, setVerticalType] = useState<string>('GAL');
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitMessage, setLimitMessage] = useState('');
  const [usageData, setUsageData] = useState<{ used: number; limit: number; percentage: number } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved) setVerticalType(saved);
    }).catch(() => {});

    // Show onboarding on first visit
    AsyncStorage.getItem('onboarding_completed').then((val) => {
      if (!val) setShowOnboarding(true);
    }).catch(() => {});
  }, []);

  // Fetch real usage data from backend
  useEffect(() => {
    if (!token) return;
    const fetchUsage = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/users/me/usage`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUsageData({
            used: data.meetings_used,
            limit: data.meetings_limit,
            percentage: data.percentage,
          });
        }
      } catch {}
    };
    fetchUsage();
  }, [token, user?.meetings_used_this_month]);

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
  const used = usageData?.used ?? (user?.meetings_used_this_month || 0);
  const limit = usageData?.limit ?? currentPlan.meetings_limit;
  const isUnlimited = limit === -1;
  const meetingsLeft = isUnlimited ? null : limit - used;
  const usagePercent = isUnlimited ? 0 : (limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0);
  const usageColor = usagePercent >= 100 ? '#EF4444' : usagePercent >= 80 ? '#F59E0B' : '#22C55E';

  const handleRecordingComplete = async (uri: string, duration: number) => {
    try {
      const createRes = await fetch(`${API_BASE_URL}/api/meetings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ vertical_type: verticalType }),
      });
      if (createRes.status === 402) {
        const err = await createRes.json().catch(() => ({ detail: '' }));
        setLimitMessage(err.detail || 'Ai atins limita planului tău.');
        setShowLimitModal(true);
        return;
      }
      if (!createRes.ok) {
        const errBody = await createRes.json().catch(() => ({ detail: `Eroare server (${createRes.status})` }));
        throw new Error(errBody.detail || `Eroare la creare meeting (${createRes.status})`);
      }
      const meeting = await createRes.json();

      const formData = new FormData();
      formData.append('file', {
        uri,
        type: 'audio/m4a',
        name: `recording_${Date.now()}.m4a`,
      } as any);

      const uploadRes = await fetch(`${API_BASE_URL}/api/meetings/${meeting._id}/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!uploadRes.ok) {
        const errBody = await uploadRes.json().catch(() => ({ detail: `Upload eșuat (${uploadRes.status})` }));
        throw new Error(errBody.detail || `Upload eșuat (${uploadRes.status})`);
      }
      await refreshUsage();
      router.push(`/meeting/${meeting._id}`);
    } catch (err: any) {
      alert(err.message || 'Eroare la încărcarea înregistrării');
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
        <View className="bg-white rounded-2xl p-4 mb-5">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 bg-navy/10 rounded-lg items-center justify-center">
                <Crown size={18} color={COLORS.navy} />
              </View>
              <View>
                <Text className="text-navy font-heading text-sm">{currentPlan.name}</Text>
                <Text className="text-gray-500 font-body text-xs">
                  {isUnlimited
                    ? 'Întâlniri nelimitate'
                    : `${used}/${limit} întâlniri folosite`}
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
          {/* Progress Bar */}
          {!isUnlimited && (
            <View>
              <View className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <View
                  className="h-full rounded-full"
                  style={{ width: `${usagePercent}%`, backgroundColor: usageColor }}
                />
              </View>
              <Text className="text-xs font-body mt-1.5" style={{ color: usageColor }}>
                {meetingsLeft !== null && meetingsLeft > 0
                  ? `${meetingsLeft} întâlniri rămase`
                  : meetingsLeft === 0
                  ? 'Limita atinsă — fă upgrade!'
                  : ''}
              </Text>
            </View>
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
              authToken={token}
              onLimitReached={(msg) => {
                setLimitMessage(msg);
                setShowLimitModal(true);
              }}
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

      {/* Plan Limit Modal */}
      <Modal
        visible={showLimitModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLimitModal(false)}
      >
        <View className="flex-1 bg-black/50 items-center justify-center px-6">
          <View className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <View className="items-center mb-4">
              <View className="w-14 h-14 bg-red-100 rounded-full items-center justify-center mb-3">
                <AlertTriangle size={28} color="#EF4444" />
              </View>
              <Text className="text-navy text-lg font-heading text-center">Limita atinsă</Text>
              <Text className="text-gray-500 text-sm font-body text-center mt-2">
                {limitMessage || 'Ai folosit toate întâlnirile incluse în planul tău.'}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setShowLimitModal(false);
                router.push('/pricing');
              }}
              className="bg-navy h-12 rounded-xl items-center justify-center mb-2"
            >
              <Text className="text-white font-heading text-sm">Vezi planuri</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowLimitModal(false)}
              className="h-12 rounded-xl items-center justify-center"
            >
              <Text className="text-gray-500 font-body text-sm">Închide</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {showOnboarding && (
        <OnboardingModal onDone={() => setShowOnboarding(false)} />
      )}
    </View>
  );
}
