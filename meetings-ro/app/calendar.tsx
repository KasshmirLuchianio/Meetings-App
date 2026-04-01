import { View, Text } from 'react-native';
import TopBar from '../src/components/TopBar';

export default function CalendarScreen() {
  return (
    <View className="flex-1 bg-ivory">
      <TopBar onMenuPress={() => console.log('Menu')} />
      <View className="flex-1 justify-center items-center">
        <Text className="text-navy text-2xl font-heading">Calendar View</Text>
        <Text className="text-gray-600 mt-2 font-body">Coming soon...</Text>
      </View>
    </View>
  );
}
