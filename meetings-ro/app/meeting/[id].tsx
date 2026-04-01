import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import DynamicReportView from '../../src/components/DynamicReportView';

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams();

  if (!id || typeof id !== 'string') {
    return (
      <View className="flex-1 bg-ivory justify-center items-center">
        <Text className="text-navy font-heading">ID întâlnire invalid</Text>
      </View>
    );
  }

  return <DynamicReportView meetingId={id} />;
}
