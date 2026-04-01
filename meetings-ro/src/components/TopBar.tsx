import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Menu, Calendar } from 'lucide-react-native';

interface TopBarProps {
  onMenuPress?: () => void;
}

export default function TopBar({ onMenuPress }: TopBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleCalendarPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/calendar');
  };

  const handleMenuPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onMenuPress?.();
  };

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="bg-ivory border-b border-gray-200"
    >
      <View className="flex-row items-center justify-between px-4 h-14">
        {/* Logo */}
        <Text className="text-navy text-xl font-heading">Meetings.ro</Text>

        {/* Right actions */}
        <View className="flex-row items-center gap-3">
          {/* Calendar button */}
          <Pressable
            onPress={handleCalendarPress}
            className="h-11 w-11 items-center justify-center rounded-full active:bg-navy/10"
          >
            <Calendar size={24} stroke="#1B2A4A" />
          </Pressable>

          {/* Menu button */}
          <Pressable
            onPress={handleMenuPress}
            className="h-11 w-11 items-center justify-center rounded-full active:bg-navy/10"
          >
            <Menu size={24} stroke="#1B2A4A" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
