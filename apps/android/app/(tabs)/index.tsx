import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { BrandMark, PrimaryButton, ProjectRow, ScreenBackdrop, SurfaceCard } from '../../components/ui';
import { type SourceKind, useGeneration } from '../../lib/generation';
import { colors, radii } from '../../lib/theme';

const sourceKinds: SourceKind[] = ['URL', 'Text', 'Markdown'];

export default function CreateScreen() {
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <BrandMark size={46} />
          <View>
            <Text style={styles.brandTitle}>Auto Video Gen</Text>
            <Text style={styles.caption}>AI short-video studio</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Paste anything.{`\n`}Turn it into a video.</Text>
          <Text style={styles.heroBody}>Start from an article, GitHub repo, text, or Markdown. The pipeline writes, voices, animates, mixes, and renders a vertical short.</Text>
        </View>

        <SurfaceCard style={styles.createCard}>
          <View style={styles.segmented}>
            {sourceKinds.map((kind) => (
              <Pressable
                key={kind}
                accessibilityRole="button"
                accessibilityState={{ selected: sourceKind === kind }}
                onPress={() => setSourceKind(kind)}
                style={[styles.segment, sourceKind === kind && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, sourceKind === kind && styles.segmentTextActive]}>{kind}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder={sourceKind === 'URL' ? 'https://example.com/article' : sourceKind === 'Text' ? 'Paste an article, idea, or script' : 'Paste Markdown content'}
            placeholderTextColor={colors.muted}
            autoCapitalize={sourceKind === 'URL' ? 'none' : 'sentences'}
            autoCorrect={sourceKind !== 'URL'}
            multiline={sourceKind !== 'URL'}
            style={[styles.input, sourceKind !== 'URL' && styles.inputMultiline]}
          />

          <PrimaryButton onPress={generate} disabled={!isGenerating && !isValid}>
            <Text style={styles.primaryLabel}>{isGenerating ? 'View Generation Progress  →' : '✦  Generate Video  →'}</Text>
          </PrimaryButton>
        </SurfaceCard>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Projects</Text>
          <Pressable onPress={() => router.push('/library')}>
            <Text style={styles.link}>See all</Text>
          </Pressable>
        </View>

        <View style={styles.projectList}>
          {projects.length === 0 ? (
            <SurfaceCard>
              <Text style={styles.emptyTitle}>No videos yet</Text>
              <Text style={styles.emptyBody}>Paste a source above to create your first rendered short.</Text>
            </SurfaceCard>
          ) : projects.slice(0, 2).map((project) => (
            <Pressable key={project.id} onPress={() => router.push({ pathname: '/preview', params: { projectId: project.id } })}>
              <ProjectRow project={project} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </ScreenBackdrop>
  );
}

const styles = StyleSheet.create({
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
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  caption: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  hero: {
    gap: 12,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  heroBody: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  createCard: {
    gap: 16,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: radii.small,
    padding: 3,
    backgroundColor: '#080D16',
  },
  segment: {
    flex: 1,
    minHeight: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: colors.text,
  },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.small,
    backgroundColor: '#080D16',
    borderWidth: 1,
    borderColor: colors.surfaceStrong,
    color: colors.text,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 130,
    textAlignVertical: 'top',
  },
  primaryLabel: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 19,
  },
  link: {
    color: colors.cyan,
    fontSize: 13,
    fontWeight: '700',
  },
  projectList: {
    gap: 12,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  emptyBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
});
