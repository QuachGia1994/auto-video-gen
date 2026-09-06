import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ProjectRow, ScreenBackdrop } from '../../components/ui';
import { useGeneration } from '../../lib/generation';
import { colors } from '../../lib/theme';

export default function LibraryScreen() {
  const { projects } = useGeneration();

  return (
    <ScreenBackdrop>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.list}>
          {projects.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No rendered videos</Text>
              <Text style={styles.emptyBody}>Create a video first. Completed renders will appear here.</Text>
            </View>
          ) : projects.map((project) => (
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
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
