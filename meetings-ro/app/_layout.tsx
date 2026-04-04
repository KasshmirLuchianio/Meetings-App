import '../global.css';
import { Stack } from 'expo-router';
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
import { DrawerProvider } from '../src/context/DrawerContext';
import { AuthProvider } from '../src/context/AuthContext';
import SlideDrawer from '../src/components/SlideDrawer';

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
      <AuthProvider>
        <DrawerProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
            <Stack.Screen name="pricing" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="browse" />
            <Stack.Screen name="calendar" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="meeting/[id]" />
          </Stack>
          <SlideDrawer />
        </DrawerProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
