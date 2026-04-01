import '../global.css';
import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from '@expo-google-fonts/dm-sans';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import CustomDrawer from '../src/components/CustomDrawer';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Drawer
        drawerContent={(props) => <CustomDrawer {...props} />}
        screenOptions={{
          headerShown: false,
          drawerType: 'slide',
          drawerStyle: {
            width: 280,
          },
          overlayColor: 'rgba(0,0,0,0.5)',
          drawerPosition: 'left',
        }}
      >
        <Drawer.Screen name="index" options={{ title: 'Acasă' }} />
        <Drawer.Screen name="browse" options={{ title: 'Întâlniri' }} />
        <Drawer.Screen name="calendar" options={{ title: 'Calendar' }} />
        <Drawer.Screen name="onboarding" options={{ title: 'Setări' }} />
        <Drawer.Screen name="meeting/[id]" options={{ title: 'Detalii' }} />
      </Drawer>
    </GestureHandlerRootView>
  );
}
