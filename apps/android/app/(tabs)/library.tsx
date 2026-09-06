import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ProjectRow, ScreenBackdrop } from '../../components/ui';
import { useGeneration } from '../../lib/generation';
import { type Palette } from '../../lib/theme';
import { useTheme } from '../../lib/theme-provider';

export default function LibraryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { projects } = useGeneration();

  return (
    <ScreenBackdrop>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 10 }]}>
        <Text style={s.pageTitle}>{t('nav.libraryHeader')}</Text>
        <View style={s.list}>
          {projects.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>{t('library.emptyTitle')}</Text>
              <Text style={s.emptyBody}>{t('library.emptyBody')}</Text>
            </View>
          ) : (
            projects.map((project) => (
              <Pressable key={project.id} onPress={() => router.push({ pathname: '/preview', params: { projectId: project.id } })}>
                <ProjectRow project={project} />
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenBackdrop>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    content: {
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 34,
    },
    pageTitle: {
      color: c.textPrimary,
      fontSize: 26,
      fontWeight: '900',
      letterSpacing: -0.5,
      marginBottom: 16,
    },
    list: {
      gap: 12,
    },
    empty: {
      alignItems: 'center',
      paddingHorizontal: 30,
      paddingVertical: 72,
      gap: 8,
    },
    emptyTitle: {
      color: c.textPrimary,
      fontSize: 18,
      fontWeight: '800',
    },
    emptyBody: {
      color: c.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
    },
  });
}
