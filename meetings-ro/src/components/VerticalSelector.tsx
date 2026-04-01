import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { API_BASE_URL } from '../constants/config';
import { VerticalConfig } from '../types';
import { COLORS } from '../constants/theme';

const STORAGE_KEY = 'selected_vertical';

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
      const data = await response.json();
      setVerticals(data.verticals);
    } catch (error) {
      console.error('Failed to load verticals:', error);
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
