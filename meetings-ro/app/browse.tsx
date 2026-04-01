import { View, Text } from 'react-native';
import TopBar from '../src/components/TopBar';

export default function BrowseScreen() {
  return (
    <View className="flex-1 bg-ivory">
      <TopBar />
      <View className="flex-1 justify-center items-center px-4">
        <Text className="text-navy text-2xl font-heading mb-2">Întâlniri</Text>
        <Text className="text-gray-600 font-body text-center">
          Lista întâlnirilor va apărea aici
        </Text>
      </View>
    </View>
  );
}
