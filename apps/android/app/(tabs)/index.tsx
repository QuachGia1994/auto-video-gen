import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { BrandMark, PrimaryButton, ProjectRow, ScreenBackdrop, SurfaceCard } from '../../components/ui';
import { type SourceKind, useGeneration } from '../../lib/generation';
import { type Palette, radii } from '../../lib/theme';
import { useTheme } from '../../lib/theme-provider';

const sourceKinds: SourceKind[] = ['URL', 'Text', 'Markdown'];
const sourceLabelKey: Record<SourceKind, string> = { URL: 'source.url', Text: 'source.text', Markdown: 'source.markdown' };
const placeholderKey: Record<SourceKind, string> = {
  URL: 'create.placeholderUrl',
  Text: 'create.placeholderText',
  Markdown: 'create.placeholderMarkdown',
};

export default function CreateScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { projects, isGenerating, queueRequest } = useGeneration();
  const [sourceKind, setSourceKind] = useState<SourceKind>('URL');
  const [content, setContent] = useState('');
  const isValid = content.trim().length > 0;

  const generate = () => {
    if (isGenerating) {
      router.push('/generate');
      return;
    }
    if (!isValid) return;
    queueRequest({ sourceKind, content });
    router.push('/generate');
  };

  return (
    <ScreenBackdrop>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 10 }]} keyboardShouldPersistTaps="handled">
        <View style={s.brandRow}>
          <BrandMark size={46} />
          <View>
            <Text style={s.brandTitle}>Auto Video Gen</Text>
            <Text style={s.caption}>{t('app.tagline')}</Text>
          </View>
        </View>

        <View style={s.hero}>
          <Text style={s.heroTitle}>{t('create.heroTitle')}</Text>
          <Text style={s.heroBody}>{t('create.heroBody')}</Text>
        </View>

        <SurfaceCard style={s.createCard}>
          <View style={s.segmented}>
            {sourceKinds.map((kind) => {
              const active = sourceKind === kind;
              return (
                <Pressable
                  key={kind}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setSourceKind(kind)}
                  style={[s.segment, active && s.segmentActive]}
                >
                  <Text style={[s.segmentText, active && s.segmentTextActive]}>{t(sourceLabelKey[kind])}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder={t(placeholderKey[sourceKind])}
            placeholderTextColor={colors.textFaint}
            autoCapitalize={sourceKind === 'URL' ? 'none' : 'sentences'}
            autoCorrect={sourceKind !== 'URL'}
            multiline={sourceKind !== 'URL'}
            style={[s.input, sourceKind !== 'URL' && s.inputMultiline]}
          />

          <PrimaryButton onPress={generate} disabled={!isGenerating && !isValid}>
            <Text style={s.primaryLabel}>
              {isGenerating ? `${t('create.ctaViewProgress')}  →` : `✦  ${t('create.ctaGenerate')}  →`}
            </Text>
          </PrimaryButton>
        </SurfaceCard>

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>{t('create.recentProjects')}</Text>
          <Pressable onPress={() => router.push('/library')}>
            <Text style={s.link}>{t('create.seeAll')}</Text>
          </Pressable>
        </View>

        <View style={s.projectList}>
          {projects.length === 0 ? (
            <SurfaceCard>
              <Text style={s.emptyTitle}>{t('create.emptyTitle')}</Text>
              <Text style={s.emptyBody}>{t('create.emptyBody')}</Text>
            </SurfaceCard>
          ) : (
            projects.slice(0, 2).map((project) => (
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
      gap: 22,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    brandTitle: {
      color: c.textPrimary,
      fontSize: 17,
      fontWeight: '800',
    },
    caption: {
      color: c.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    hero: {
      gap: 12,
    },
    heroTitle: {
      color: c.textPrimary,
      fontSize: 34,
      lineHeight: 39,
      fontWeight: '900',
      letterSpacing: -0.7,
    },
    heroBody: {
      color: c.textSecondary,
      fontSize: 15,
      lineHeight: 22,
    },
    createCard: {
      gap: 16,
    },
    segmented: {
      flexDirection: 'row',
      borderRadius: radii.control,
      padding: 4,
      backgroundColor: c.inputBg,
      borderWidth: 1,
      borderColor: c.border,
    },
    segment: {
      flex: 1,
      minHeight: 38,
      borderRadius: radii.small,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentActive: {
      backgroundColor: c.accent,
      shadowColor: c.accent,
      shadowOpacity: 0.4,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
    segmentText: {
      color: c.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    segmentTextActive: {
      color: '#FFFFFF',
    },
    input: {
      minHeight: 50,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: radii.small,
      backgroundColor: c.inputBg,
      borderWidth: 1,
      borderColor: c.border,
      color: c.textPrimary,
      fontSize: 15,
    },
    inputMultiline: {
      minHeight: 130,
      textAlignVertical: 'top',
    },
    primaryLabel: {
      color: c.onAccent,
      fontWeight: '800',
      fontSize: 15,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      color: c.textPrimary,
      fontWeight: '800',
      fontSize: 19,
    },
    link: {
      color: c.accentAlt,
      fontSize: 13,
      fontWeight: '700',
    },
    projectList: {
      gap: 12,
    },
    emptyTitle: {
      color: c.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    emptyBody: {
      color: c.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 5,
    },
  });
}
