import React from 'react';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../lib/theme-provider';

// Native system bottom tabs (Material bottom navigation on Android, Liquid Glass on iOS 26+).
// Icons use Android Material Symbols via `md`; app is Android-only so SF Symbols are omitted.
export default function TabLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <NativeTabs
      backgroundColor={colors.tabBar}
      iconColor={{ default: colors.textFaint, selected: colors.accentAlt }}
      indicatorColor={colors.accent}
      labelStyle={{ default: { color: colors.textFaint }, selected: { color: colors.accentAlt } }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon md="auto_awesome" />
        <NativeTabs.Trigger.Label>{t('nav.create')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="library">
        <NativeTabs.Trigger.Icon md="video_library" />
        <NativeTabs.Trigger.Label>{t('nav.library')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon md="settings" />
        <NativeTabs.Trigger.Label>{t('nav.settings')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
