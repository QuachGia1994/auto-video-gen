import React, { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BrandMark, PrimaryButton, ScreenBackdrop, SurfaceCard } from '../components/ui';
import { STEP_KEYS, useGeneration } from '../lib/generation';
import { type Palette } from '../lib/theme';
import { useTheme } from '../lib/theme-provider';

export default function GenerateScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { steps, isGenerating, currentProject, queuedRequest, errorMessage, startQueuedGeneration } = useGeneration();
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !queuedRequest) return;
    started.current = true;
    void startQueuedGeneration();
  }, [queuedRequest, startQueuedGeneration]);

  const title = isGenerating ? t('generate.creatingTitle') : currentProject ? t('generate.completeTitle') : t('generate.readyTitle');
  const subtitle = isGenerating
    ? t('generate.creatingSubtitle')
    : currentProject
      ? t('generate.completeSubtitle')
      : t('generate.readySubtitle');

  return (
    <ScreenBackdrop>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.hero}>
          <BrandMark size={54} />
          <Text style={s.title}>{title}</Text>
          <Text style={s.subtitle}>{subtitle}</Text>
        </View>

        <SurfaceCard style={s.stepsCard}>
          {steps.map((step, index) => {
            const done = step.progress >= 1;
            return (
              <View key={step.id} style={s.stepRow}>
                <View style={[s.stepBadge, done && s.stepBadgeComplete]}>
                  <Text style={s.stepBadgeText}>{done ? '✓' : index + 1}</Text>
                </View>
                <View style={s.stepContent}>
                  <View style={s.stepHeader}>
                    <Text style={s.stepTitle}>{t(STEP_KEYS[step.id].titleKey)}</Text>
                    <Text style={s.progressText}>{Math.round(step.progress * 100)}%</Text>
                  </View>
                  <Text style={s.detail}>{t(STEP_KEYS[step.id].detailKey)}</Text>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, done && s.progressComplete, { width: `${step.progress * 100}%` }]} />
                  </View>
                </View>
              </View>
            );
          })}
        </SurfaceCard>

        {errorMessage ? (
          <SurfaceCard style={s.errorCard}>
            <Text style={s.errorTitle}>{t('generate.stopped')}</Text>
            <Text style={s.detail}>{errorMessage}</Text>
            <PrimaryButton onPress={() => void startQueuedGeneration()}>
              <Text style={s.primaryLabel}>{t('generate.tryAgain')}</Text>
            </PrimaryButton>
          </SurfaceCard>
        ) : null}

        {currentProject && !isGenerating ? (
          <PrimaryButton onPress={() => router.replace({ pathname: '/preview', params: { projectId: currentProject.id } })}>
            <Text style={s.primaryLabel}>{`▶  ${t('generate.reviewVideo')}`}</Text>
          </PrimaryButton>
        ) : null}
      </ScrollView>
    </ScreenBackdrop>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
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
      color: c.textPrimary,
      fontSize: 23,
      fontWeight: '900',
      marginTop: 5,
    },
    subtitle: {
      color: c.textSecondary,
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
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBadgeComplete: {
      backgroundColor: c.success,
    },
    stepBadgeText: {
      color: '#FFFFFF',
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
      color: c.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    progressText: {
      color: c.textSecondary,
      fontSize: 12,
      fontVariant: ['tabular-nums'],
    },
    detail: {
      color: c.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
      backgroundColor: c.surfaceAlt,
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: c.accentAlt,
    },
    progressComplete: {
      backgroundColor: c.success,
    },
    errorCard: {
      gap: 12,
    },
    errorTitle: {
      color: c.danger,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 6,
    },
    primaryLabel: {
      color: c.onAccent,
      fontSize: 15,
      fontWeight: '800',
    },
  });
}
