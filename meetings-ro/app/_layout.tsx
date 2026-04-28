import '../global.css';
import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Sentry from '@sentry/react-native';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
  debug: false,
  tracesSampleRate: 0.2,
});
import NetInfo from '@react-native-community/netinfo';
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
import { RecordingProvider } from '../src/context/RecordingContext';
import SlideDrawer from '../src/components/SlideDrawer';
import RecordingScreen from '../src/components/RecordingScreen';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#FAF8F3' }}>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1B2A4A', marginBottom: 8 }}>
            Ceva nu a mers bine
          </Text>
          <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 }}>
            A apărut o eroare neașteptată. Încearcă să repornești aplicația.
          </Text>
          <Pressable
            onPress={() => this.setState({ hasError: false })}
            style={{ backgroundColor: '#1B2A4A', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
          >
            <Text style={{ color: '#FAF8F3', fontWeight: '600' }}>Încearcă din nou</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

async function registerForPushNotifications() {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }
  } catch {
    // Push notifications not available (e.g. simulator)
  }
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
  });
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    registerForPushNotifications();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <RecordingProvider>
            <DrawerProvider>
              <View style={{ flex: 1 }}>
                <StatusBar style="dark" />
                {isOffline && (
                  <View style={{ backgroundColor: '#1B2A4A', padding: 8, alignItems: 'center' }}>
                    <Text style={{ color: '#FAF8F3', fontSize: 13, fontWeight: '500' }}>Fără conexiune la internet</Text>
                  </View>
                )}
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
                  <Stack.Screen name="verify-email" options={{ animation: 'fade' }} />
                  <Stack.Screen name="forgot-password" />
                  <Stack.Screen name="pricing" options={{ animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="browse" />
                  <Stack.Screen name="calendar" />
                  <Stack.Screen name="onboarding" />
                  <Stack.Screen name="team" options={{ headerShown: false }} />
                  <Stack.Screen name="create-org" options={{ headerShown: false }} />
                  <Stack.Screen name="meeting/[id]" />
                </Stack>
                <SlideDrawer />
                <RecordingScreen />
              </View>
            </DrawerProvider>
          </RecordingProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
