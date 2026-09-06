import React, { useMemo } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { PrimaryButton, ScreenBackdrop, SurfaceCard } from '../components/ui';
import { useGeneration } from '../lib/generation';
import { type Palette, radii } from '../lib/theme';
import { useTheme } from '../lib/theme-provider';

export default function PreviewScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const { currentProject, findProject } = useGeneration();
  const project = projectId ? findProject(projectId) : currentProject ?? undefined;

  if (!project) {
    return (
      <ScreenBackdrop style={s.empty}>
        <Text style={s.emptyTitle}>{t('preview.emptyTitle')}</Text>
        <Text style={s.subtitle}>{t('preview.emptyBody')}</Text>
      </ScreenBackdrop>
    );
  }

  const exportVideo = async () => {
    if (!project.videoUrl) {
      Alert.alert(t('preview.unavailableTitle'), t('preview.unavailableBody'), [{ text: t('common.ok') }]);
      return;
    }
    await Linking.openURL(project.videoUrl);
  };

  const sceneLabel = (index: number) =>
    index === 0 ? t('scene.hook') : index === project.sceneCount - 1 ? t('scene.outro') : t('scene.keyPoint');

  return (
    <ScreenBackdrop>
      <ScrollView contentContainerStyle={s.content}>
        <LinearGradient
          colors={['#05070E', colors.accent, colors.accentAlt]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={s.videoFrame}
          accessibilityLabel={`${t('nav.preview')}: ${project.title}`}
        >
          <Text style={s.sparkle}>✦</Text>
          <Text style={s.videoTitle}>{project.title.toUpperCase()}</Text>
          <Text style={s.videoSubtitle}>{t('preview.mockupTagline')}</Text>
          <Text style={s.play}>▶</Text>
          <Text style={s.time}>{project.duration ? `0:00 / ${project.duration}` : t('preview.renderedMp4')}</Text>
        </LinearGradient>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('preview.scenes')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.sceneStrip}>
            {Array.from({ length: project.sceneCount }, (_, index) => (
              <SurfaceCard key={index} style={s.sceneCard}>
                <Text style={s.sceneNumber}>{String(index + 1).padStart(2, '0')}</Text>
                <Text style={s.sceneLabel}>{sceneLabel(index)}</Text>
              </SurfaceCard>
            ))}
          </ScrollView>
        </View>

        <View style={s.optionsRow}>
          <SurfaceCard style={s.optionCard}>
            <Text style={s.optionLabel}>{t('preview.theme')}</Text>
            <Text numberOfLines={1} style={s.optionValue}>{project.theme}</Text>
          </SurfaceCard>
          <SurfaceCard style={s.optionCard}>
            <Text style={s.optionLabel}>{t('preview.voice')}</Text>
            <Text numberOfLines={1} style={s.optionValue}>{project.voice}</Text>
          </SurfaceCard>
        </View>

        <PrimaryButton onPress={exportVideo}>
          <Text style={s.primaryLabel}>{`⇧  ${t('preview.exportMp4')}`}</Text>
        </PrimaryButton>
      </ScrollView>
    </ScreenBackdrop>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    content: {
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 34,
      gap: 20,
      alignItems: 'center',
    },
    empty: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      gap: 8,
    },
    emptyTitle: {
      color: c.textPrimary,
      fontSize: 22,
      fontWeight: '900',
    },
    subtitle: {
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    videoFrame: {
      width: '86%',
      maxWidth: 320,
      aspectRatio: 9 / 16,
      borderRadius: 28,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 22,
      shadowColor: c.accent,
      shadowOpacity: 0.4,
      shadowRadius: 30,
      shadowOffset: { width: 0, height: 18 },
      elevation: 12,
    },
    sparkle: {
      color: '#FFFFFF',
      fontSize: 42,
      fontWeight: '900',
      marginBottom: 14,
    },
    videoTitle: {
      color: '#FFFFFF',
      fontSize: 28,
      lineHeight: 33,
      fontWeight: '900',
      textAlign: 'center',
    },
    videoSubtitle: {
      color: 'rgba(255,255,255,0.82)',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.3,
      textAlign: 'center',
      marginTop: 12,
    },
    play: {
      color: '#FFFFFF',
      fontSize: 52,
      marginTop: 42,
    },
    time: {
      position: 'absolute',
      bottom: 18,
      color: 'rgba(255,255,255,0.78)',
      fontSize: 11,
      fontVariant: ['tabular-nums'],
    },
    section: {
      width: '100%',
      gap: 10,
    },
    sectionTitle: {
      color: c.textPrimary,
      fontSize: 17,
      fontWeight: '800',
    },
    sceneStrip: {
      gap: 10,
    },
    sceneCard: {
      width: 96,
      padding: 12,
      borderRadius: radii.small,
    },
    sceneNumber: {
      color: c.accentAlt,
      fontSize: 11,
      fontWeight: '700',
    },
    sceneLabel: {
      color: c.textPrimary,
      fontSize: 12,
      fontWeight: '800',
      marginTop: 5,
    },
    optionsRow: {
      flexDirection: 'row',
      gap: 12,
      width: '100%',
    },
    optionCard: {
      flex: 1,
    },
    optionLabel: {
      color: c.textSecondary,
      fontSize: 11,
    },
    optionValue: {
      color: c.textPrimary,
      fontSize: 14,
      fontWeight: '800',
      marginTop: 7,
    },
    primaryLabel: {
      color: c.onAccent,
      fontSize: 15,
      fontWeight: '800',
    },
  });
}
