import React from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { PrimaryButton, ScreenBackdrop, SurfaceCard } from '../components/ui';
import { useGeneration } from '../lib/generation';
import { colors } from '../lib/theme';

export default function PreviewScreen() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const { currentProject, findProject } = useGeneration();
  const project = projectId ? findProject(projectId) : currentProject ?? undefined;

  if (!project) {
    return (
      <ScreenBackdrop style={styles.empty}>
        <Text style={styles.emptyTitle}>Preview unavailable</Text>
        <Text style={styles.subtitle}>Open a completed project from Library or generate a new video first.</Text>
      </ScreenBackdrop>
    );
  }

  const exportVideo = async () => {
    if (!project.videoUrl) {
      Alert.alert('Video unavailable', 'This project does not have a rendered MP4 URL.');
      return;
    }
    await Linking.openURL(project.videoUrl);
  };

  return (
    <ScreenBackdrop>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.videoFrame} accessibilityLabel={`Video preview mockup for ${project.title}`}>
          <Text style={styles.sparkle}>✦</Text>
          <Text style={styles.videoTitle}>{project.title.toUpperCase()}</Text>
          <Text style={styles.videoSubtitle}>A BRIGHTER STORY IN 60 SECONDS</Text>
          <Text style={styles.play}>▶</Text>
          <Text style={styles.time}>{project.duration ? `0:00 / ${project.duration}` : 'Rendered MP4'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scenes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sceneStrip}>
            {Array.from({ length: project.sceneCount }, (_, index) => (
              <SurfaceCard key={index} style={styles.sceneCard}>
                <Text style={styles.sceneNumber}>{String(index + 1).padStart(2, '0')}</Text>
                <Text style={styles.sceneLabel}>{index === 0 ? 'Hook' : index === project.sceneCount - 1 ? 'Outro' : 'Key point'}</Text>
              </SurfaceCard>
            ))}
          </ScrollView>
        </View>

        <View style={styles.optionsRow}>
          <SurfaceCard style={styles.optionCard}>
            <Text style={styles.optionLabel}>Theme</Text>
            <Text numberOfLines={1} style={styles.optionValue}>{project.theme}</Text>
          </SurfaceCard>
          <SurfaceCard style={styles.optionCard}>
            <Text style={styles.optionLabel}>Voice</Text>
            <Text numberOfLines={1} style={styles.optionValue}>{project.voice}</Text>
          </SurfaceCard>
        </View>

        <PrimaryButton onPress={exportVideo}>
          <Text style={styles.primaryLabel}>⇧  Export MP4</Text>
        </PrimaryButton>
      </ScrollView>
    </ScreenBackdrop>
  );
}

const styles = StyleSheet.create({
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
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
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
    backgroundColor: '#17112F',
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    elevation: 10,
  },
  sparkle: {
    color: colors.cyan,
    fontSize: 42,
    fontWeight: '900',
    marginBottom: 14,
  },
  videoTitle: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
    textAlign: 'center',
  },
  videoSubtitle: {
    color: '#C7C9D2',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    textAlign: 'center',
    marginTop: 12,
  },
  play: {
    color: colors.text,
    fontSize: 52,
    marginTop: 42,
  },
  time: {
    position: 'absolute',
    bottom: 18,
    color: colors.muted,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  section: {
    width: '100%',
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  sceneStrip: {
    gap: 10,
  },
  sceneCard: {
    width: 96,
    padding: 12,
    borderRadius: 14,
  },
  sceneNumber: {
    color: colors.cyan,
    fontSize: 11,
    fontWeight: '700',
  },
  sceneLabel: {
    color: colors.text,
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
    color: colors.muted,
    fontSize: 11,
  },
  optionValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 7,
  },
  primaryLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
});
