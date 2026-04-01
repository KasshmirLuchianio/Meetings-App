import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import TopBar from '../src/components/TopBar';
import AudioRecorder from '../src/components/AudioRecorder';
import AudioUploader from '../src/components/AudioUploader';
import { Mic, Upload } from 'lucide-react-native';
import { COLORS } from '../src/constants/theme';
import { API_BASE_URL } from '../src/constants/config';

const STORAGE_KEY = 'selected_vertical';

export default function HomeScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'record' | 'upload'>('record');
  const [verticalType, setVerticalType] = useState<string>('GAL');

  useEffect(() => {
    loadVerticalType();
  }, []);

  const loadVerticalType = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        setVerticalType(saved);
      }
    } catch (error) {
      console.error('Failed to load vertical type:', error);
    }
  };

  const handleRecordingComplete = async (uri: string, duration: number) => {
    try {
      // Create meeting
      const createRes = await fetch(`${API_BASE_URL}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vertical_type: verticalType }),
      });

      if (!createRes.ok) throw new Error('Failed to create meeting');

      const meeting = await createRes.json();

      // Upload audio
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

      // Navigate to meeting detail
      router.push(`/meeting/${meeting._id}`);
    } catch (error) {
      console.error('Recording upload error:', error);
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
      <TopBar onMenuPress={() => {}} />

      <ScrollView className="flex-1" contentContainerClassName="px-4 py-6">
        {/* Tabs */}
        <View className="flex-row bg-white rounded-xl p-1 mb-6">
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
            <View className="items-center py-8">
              <Text className="text-navy text-2xl font-heading mb-2 text-center">
                Înregistrare nouă
              </Text>
              <Text className="text-gray-600 text-sm font-body mb-8 text-center">
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

        {/* Info card */}
        <View className="mt-6 p-4 bg-white rounded-xl">
          <Text className="text-navy text-sm font-heading mb-1">
            Domeniu selectat: {verticalType}
          </Text>
          <Text className="text-gray-600 text-xs font-body">
            Schimbă din Setări pentru alt tip de întâlnire
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
