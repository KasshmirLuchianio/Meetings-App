import { View, Text } from 'react-native';
import TopBar from '../src/components/TopBar';

export default function HomeScreen() {
  return (
    <View className="flex-1 bg-ivory">
      <TopBar onMenuPress={() => console.log('Menu pressed')} />
      <View className="flex-1 justify-center items-center">
        <Text className="text-navy text-3xl font-heading mb-2">Meetings.ro</Text>
        <Text className="text-gray-600 text-base font-body">Expo + NativeWind funcționează! 🎉</Text>
      </View>
    </View>
  );
}
