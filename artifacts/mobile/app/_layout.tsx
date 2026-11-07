import React, { useEffect } from 'react';
import { AppState, Platform, View } from 'react-native';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold, useFonts } from '@expo-google-fonts/ibm-plex-sans';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useGetMe } from '@workspace/api-client-react';
import '@/lib/client';
import { configurationError } from '@/lib/config';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { useColors } from '@/hooks/useColors';
import { Button, ScreenState } from '@/components/ScreenState';
import { fonts } from '@/constants/theme';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({ defaultOptions: {
  queries: { retry: false, staleTime: 5_000, refetchOnWindowFocus: true },
  mutations: { retry: false },
} });

function RootLayoutNav() {
  const auth = useAuth(); const c = useColors();
  // Revalidate the bearer session while active, including after returning from background.
  useGetMe({ query: { enabled: !!auth.user, refetchInterval: 60_000, retry: false } });
  if (configurationError) return <ScreenState title="API configuration needed" message={configurationError} error={new Error(configurationError)} />;
  if (auth.restoring) return <ScreenState loading title="Restoring your session" />;
  if (auth.restoreError) return <View style={{ flex: 1, backgroundColor: c.background }}>
    <ScreenState title="Couldn’t restore your session" error={new Error(auth.restoreError)} retry={() => void auth.restore()} />
    <View style={{ padding: 24 }}><Button title="Clear session & sign in" testID="restore-clear" secondary onPress={() => void auth.signOut()} /></View>
  </View>;
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back', headerTintColor: c.foreground,
      headerStyle: { backgroundColor: c.background }, headerShadowVisible: false,
      headerTitleStyle: { fontFamily: fonts.semibold }, contentStyle: { backgroundColor: c.background } }}>
      <Stack.Protected guard={!auth.user}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!!auth.user}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="tickets/[id]" options={{ title: 'Ticket details' }} />
        <Stack.Screen name="report" options={{ title: 'Report a hazard' }} />
        <Stack.Screen name="tickets/[id]/repair" options={{ title: 'Repair evidence' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold,
    BricolageGrotesque_700Bold, JetBrainsMono_400Regular,
  });

  useEffect(() => {
    if (Platform.OS === 'web') return;
    focusManager.setFocused(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', state => focusManager.setFocused(state === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <StatusBar style="light" />
                <RootLayoutNav />
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </ErrorBoundary>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
