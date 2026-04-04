import { View } from 'react-native';
import TopBar from '../src/components/TopBar';
import VerticalSelector from '../src/components/VerticalSelector';

export default function OnboardingScreen() {
  return (
    <View className="flex-1 bg-ivory">
      <TopBar showBack />
      <VerticalSelector />
    </View>
  );
}
