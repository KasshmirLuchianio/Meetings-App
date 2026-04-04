import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { API_BASE_URL } from '../constants/config';
import { VerticalConfig } from '../types';
import { COLORS } from '../constants/theme';

const STORAGE_KEY = 'selected_vertical';

const FALLBACK_VERTICALS = [
  { name: 'GAL', display_name_ro: 'GAL', icon: '🏛️', description_ro: 'Ședințe și rapoarte pentru Grupuri de Acțiune Locală', color_accent: '#1B2A4A' },
  { name: 'JOURNALISM', display_name_ro: 'Jurnalism', icon: '📰', description_ro: 'Interviuri, declarații și materiale jurnalistice', color_accent: '#B8962E' },
  { name: 'LEGAL', display_name_ro: 'Legal', icon: '⚖️', description_ro: 'Consultări juridice și negocieri contractuale', color_accent: '#8B4513' },
  { name: 'BANKING', display_name_ro: 'Banking', icon: '🏦', description_ro: 'Ședințe bancare și financiare cu focus pe compliance', color_accent: '#2C5F2D' },
  { name: 'HEALTHCARE', display_name_ro: 'Sănătate', icon: '🏥', description_ro: 'Consultații medicale, rapoarte clinice și ședințe medicale', color_accent: '#DC2626' },
  { name: 'STARTUPS', display_name_ro: 'Startups & Tech', icon: '🚀', description_ro: 'Board meetings, pitch-uri, sprint reviews și ședințe de echipă', color_accent: '#7C3AED' },
];

export default function VerticalSelector() {
  const [verticals, setVerticals] = useState<VerticalConfig[]>([]);
  const [selectedVertical, setSelectedVertical] = useState<string>('GAL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVerticals();
    loadSelectedVertical();
  }, []);

  const loadVerticals = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/verticals`);
      if (!response.ok) throw new Error('API not available');
      const data = await response.json();
      setVerticals(data.verticals);
    } catch {
      setVerticals(FALLBACK_VERTICALS as any);
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedVertical = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSelectedVertical(saved);
      }
    } catch (error) {
      console.error('Failed to load selected vertical:', error);
    }
  };

  const handleSelectVertical = async (name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedVertical(name);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, name);
    } catch (error) {
      console.error('Failed to save vertical:', error);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-ivory justify-center items-center">
        <ActivityIndicator size="large" color={COLORS.navy} />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-ivory">
      <View className="px-4 py-8">
        <Text className="text-navy text-3xl font-heading mb-2">Alege domeniul</Text>
        <Text className="text-gray-600 text-base font-body mb-6">
          Selectează tipul de întâlniri pe care le vei înregistra
        </Text>

        <View className="space-y-4">
          {verticals.map((vertical) => (
            <Pressable
              key={vertical.name}
              onPress={() => handleSelectVertical(vertical.name)}
              className={`p-4 rounded-2xl border-2 ${
                selectedVertical === vertical.name
                  ? 'bg-navy/5 border-navy'
                  : 'bg-white border-gray-200'
              }`}
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-2xl">{vertical.icon}</Text>
                    <Text className="text-navy text-lg font-heading">
                      {vertical.display_name_ro}
                    </Text>
                  </View>
                  <Text className="text-gray-600 text-sm font-body">
                    {vertical.description_ro}
                  </Text>
                </View>

                {selectedVertical === vertical.name && (
                  <View
                    className="h-6 w-6 rounded-full items-center justify-center"
                    style={{ backgroundColor: vertical.color_accent }}
                  >
                    <Check size={16} color="white" strokeWidth={3} />
                  </View>
                )}
              </View>
            </Pressable>
          ))}
        </View>

        <Text className="text-gray-500 text-sm font-body text-center mt-6">
          Poți schimba oricând din Setări
        </Text>
      </View>
    </ScrollView>
  );
}
