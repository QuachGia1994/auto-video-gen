import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BrandMark, PrimaryButton, ScreenBackdrop, SurfaceCard } from '../components/ui';
import { useGeneration } from '../lib/generation';
import { colors } from '../lib/theme';

export default function GenerateScreen() {
  const { steps, isGenerating, currentProject, queuedRequest, errorMessage, startQueuedGeneration } = useGeneration();
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !queuedRequest) return;
    started.current = true;
    void startQueuedGeneration();
  }, [queuedRequest, startQueuedGeneration]);

  return (
    <ScreenBackdrop>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <BrandMark size={54} />
          <Text style={styles.title}>{isGenerating ? 'Creating your video' : currentProject ? 'Generation complete' : 'Ready to generate'}</Text>
          <Text style={styles.subtitle}>{isGenerating ? 'The pipeline is working through each production stage.' : currentProject ? 'Your preview is ready to review.' : 'Return to Create and provide a source first.'}</Text>
        </View>

        <SurfaceCard style={styles.stepsCard}>
          {steps.map((step, index) => (
            <View key={step.id} style={styles.stepRow}>
              <View style={[styles.stepBadge, step.progress >= 1 && styles.stepBadgeComplete]}>
                <Text style={styles.stepBadgeText}>{step.progress >= 1 ? '✓' : index + 1}</Text>
              </View>
              <View style={styles.stepContent}>
                <View style={styles.stepHeader}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.progressText}>{Math.round(step.progress * 100)}%</Text>
                </View>
                <Text style={styles.detail}>{step.detail}</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, step.progress >= 1 && styles.progressComplete, { width: `${step.progress * 100}%` }]} />
                </View>
              </View>
            </View>
          ))}
        </SurfaceCard>

        {errorMessage ? (
          <SurfaceCard style={styles.errorCard}>
            <Text style={styles.errorTitle}>Generation stopped</Text>
            <Text style={styles.detail}>{errorMessage}</Text>
            <PrimaryButton onPress={() => void startQueuedGeneration()}>
              <Text style={styles.primaryLabel}>Try Again</Text>
            </PrimaryButton>
          </SurfaceCard>
        ) : null}

        {currentProject && !isGenerating ? (
          <PrimaryButton onPress={() => router.replace({ pathname: '/preview', params: { projectId: currentProject.id } })}>
            <Text style={styles.primaryLabel}>▶  Review Video</Text>
          </PrimaryButton>
        ) : null}
      </ScrollView>
    </ScreenBackdrop>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 34,
    gap: 20,
  },
  hero: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '900',
    marginTop: 5,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },
  stepsCard: {
    gap: 20,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 13,
  },
  stepBadge: {
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeComplete: {
    backgroundColor: colors.success,
  },
  stepBadgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  stepContent: {
    flex: 1,
    gap: 7,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  progressText: {
    color: colors.muted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  detail: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: colors.surfaceStrong,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.cyan,
  },
  progressComplete: {
    backgroundColor: colors.success,
  },
  errorCard: {
    gap: 12,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  primaryLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
});
