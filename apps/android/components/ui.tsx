import React from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps, type ViewProps } from 'react-native';
import { colors, radii } from '../lib/theme';
import type { VideoProject } from '../lib/generation';

export function BrandMark({ size = 44 }: { size?: number }) {
  return (
    <View style={[styles.markOuter, { width: size, height: size, borderRadius: size * 0.25 }]}>
      <View style={[styles.markInner, { borderRadius: size * 0.19, margin: size * 0.09 }]}>
        <View style={[styles.playTriangle, {
          borderTopWidth: size * 0.16,
          borderBottomWidth: size * 0.16,
          borderLeftWidth: size * 0.25,
          marginLeft: size * 0.05,
        }]} />
      </View>
      <Text style={[styles.sparkle, { fontSize: size * 0.28, right: -size * 0.06, top: -size * 0.12 }]}>✦</Text>
    </View>
  );
}

export function ScreenBackdrop({ children, style }: ViewProps) {
  return <View style={[styles.backdrop, style]}>{children}</View>;
}

export function SurfaceCard({ children, style }: ViewProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({ children, disabled, style, ...props }: PressableProps) {
  return (
    <Pressable
      {...props}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.primaryButtonDisabled,
        pressed && !disabled && styles.primaryButtonPressed,
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function ProjectRow({ project }: { project: VideoProject }) {
  return (
    <SurfaceCard style={styles.projectRow}>
      <View style={styles.thumbnail}>
        <Text style={styles.thumbnailPlay}>▶</Text>
      </View>
      <View style={styles.projectInfo}>
        <Text numberOfLines={2} style={styles.projectTitle}>{project.title}</Text>
        <Text style={styles.projectMeta}>{project.duration ?? 'Rendered'} · {relativeDate(project.createdAt)}</Text>
        <Text style={styles.projectStatus}>{project.status}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </SurfaceCard>
  );
}

function relativeDate(timestamp: number) {
  const seconds = Math.max(1, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.background,
  },
  markOuter: {
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.blue,
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  markInner: {
    flex: 1,
    backgroundColor: '#070B13',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.text,
  },
  sparkle: {
    position: 'absolute',
    color: colors.cyan,
    fontWeight: '900',
  },
  card: {
    width: '100%',
    padding: 16,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceStrong,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: radii.control,
    paddingHorizontal: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  thumbnail: {
    width: 58,
    height: 72,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cyan,
  },
  thumbnailPlay: {
    color: colors.text,
    fontSize: 20,
  },
  projectInfo: {
    flex: 1,
    gap: 5,
  },
  projectTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 21,
  },
  projectMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  projectStatus: {
    color: colors.success,
    fontWeight: '700',
    fontSize: 11,
  },
  chevron: {
    color: colors.muted,
    fontSize: 28,
  },
});
