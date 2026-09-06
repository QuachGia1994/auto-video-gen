import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { GenerationProvider } from '../lib/generation';
import { ThemeProvider, useTheme } from '../lib/theme-provider';
import { loadPersistedLanguage } from '../lib/i18n';

function ThemedStack() {
  const { colors, scheme } = useTheme();
  const { t } = useTranslation();

  return (
    <>
      <StatusBar barStyle={scheme === 'light' ? 'dark-content' : 'light-content'} backgroundColor={colors.bg} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="generate" options={{ title: t('nav.pipeline') }} />
        <Stack.Screen name="preview" options={{ title: t('nav.preview') }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    void loadPersistedLanguage();
  }, []);

  return (
    <ThemeProvider>
      <GenerationProvider>
        <ThemedStack />
      </GenerationProvider>
    </ThemeProvider>
  );
}
