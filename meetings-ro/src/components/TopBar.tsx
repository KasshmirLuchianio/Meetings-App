import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Menu, Calendar, ArrowLeft } from 'lucide-react-native';
import { useDrawer } from '../context/DrawerContext';

interface TopBarProps {
  showBack?: boolean;
}

export default function TopBar({ showBack }: TopBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toggleDrawer } = useDrawer();

  const handleCalendarPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.navigate('/calendar');
  };

  const handleMenuPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleDrawer();
  };

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="bg-ivory border-b border-gray-200"
    >
      <View className="flex-row items-center justify-between px-4 h-14">
        <View className="flex-row items-center gap-2">
          {showBack && (
            <Pressable
              onPress={handleBackPress}
              className="h-11 w-11 items-center justify-center rounded-full active:bg-navy/10"
            >
              <ArrowLeft size={24} stroke="#1B2A4A" />
            </Pressable>
          )}
          <Text className="text-navy text-xl font-heading">Meetings.ro</Text>
        </View>

        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={handleCalendarPress}
            className="h-11 w-11 items-center justify-center rounded-full active:bg-navy/10"
          >
            <Calendar size={24} stroke="#1B2A4A" />
          </Pressable>

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
