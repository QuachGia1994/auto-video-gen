import React from 'react';
import { StatusBar } from 'react-native';
import { Stack } from 'expo-router';
import { GenerationProvider } from '../lib/generation';
import { colors } from '../lib/theme';

export default function RootLayout() {
  return (
    <GenerationProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="generate" options={{ title: 'Pipeline' }} />
        <Stack.Screen name="preview" options={{ title: 'Preview' }} />
      </Stack>
    </GenerationProvider>
  );
}
