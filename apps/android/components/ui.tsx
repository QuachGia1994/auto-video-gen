import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ViewProps,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { type Palette, radii } from '../lib/theme';
import { useTheme } from '../lib/theme-provider';
import type { ProjectStatus, VideoProject } from '../lib/generation';

export function BrandMark({ size = 44 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: size, height: size }}>
      <LinearGradient
        colors={colors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.28,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.accent,
          shadowOpacity: 0.4,
          shadowRadius: size * 0.3,
          shadowOffset: { width: 0, height: size * 0.12 },
          elevation: 8,
        }}
      >
        <View
          style={{
            width: size * 0.66,
            height: size * 0.66,
            borderRadius: size * 0.2,
            backgroundColor: colors.scheme === 'light' ? 'rgba(9,14,26,0.86)' : '#070B13',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 0,
              height: 0,
              borderTopWidth: size * 0.15,
              borderBottomWidth: size * 0.15,
              borderLeftWidth: size * 0.24,
              borderTopColor: 'transparent',
              borderBottomColor: 'transparent',
              borderLeftColor: '#FFFFFF',
              marginLeft: size * 0.06,
            }}
          />
        </View>
      </LinearGradient>
      <Text
        style={{
          position: 'absolute',
          right: -size * 0.05,
          top: -size * 0.11,
          color: colors.accentAlt,
          fontSize: size * 0.28,
          fontWeight: '900',
        }}
      >
        ✦
      </Text>
    </View>
  );
}

export function ScreenBackdrop({ children, style }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: colors.bg }, style]}>
      <LinearGradient
        pointerEvents="none"
        colors={[colors.glowTint, 'transparent']}
        start={{ x: 0.85, y: 0 }}
        end={{ x: 0.2, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

export function SurfaceCard({ children, style }: ViewProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return <View style={[s.card, style]}>{children}</View>;
}

export function PrimaryButton({ children, disabled, style, ...props }: PressableProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      {...props}
      disabled={disabled}
      style={({ pressed }) => [
        {
          borderRadius: radii.control,
          shadowColor: colors.accent,
          shadowOpacity: disabled ? 0 : 0.45,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: disabled ? 0 : 8,
          opacity: disabled ? 0.45 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed && !disabled ? 0.99 : 1 }],
        },
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
    >
      <LinearGradient
        colors={colors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          minHeight: 54,
          borderRadius: radii.control,
          paddingHorizontal: 18,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children as React.ReactNode}
      </LinearGradient>
    </Pressable>
  );
}

const STATUS_META: Record<ProjectStatus, { key: string; tone: keyof Palette }> = {
  Draft: { key: 'status.draft', tone: 'textFaint' },
  Processing: { key: 'status.processing', tone: 'accentAlt' },
  Completed: { key: 'status.completed', tone: 'success' },
};

export function StatusPill({ status }: { status: ProjectStatus }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const meta = STATUS_META[status];
  const tone = colors[meta.tone] as string;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: radii.pill,
        backgroundColor: withAlpha(tone, 0.16),
      }}
    >
      <Text style={{ color: tone, fontWeight: '800', fontSize: 11 }}>{t(meta.key)}</Text>
    </View>
  );
}

export function ProjectRow({ project }: { project: VideoProject }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[s.card, s.projectRow]}>
      <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.thumbnail}>
        <Text style={s.thumbnailPlay}>▶</Text>
      </LinearGradient>
      <View style={s.projectInfo}>
        <Text numberOfLines={2} style={s.projectTitle}>{project.title}</Text>
        <Text style={s.projectMeta}>
          {project.duration ?? t('common.rendered')} · {relativeDate(project.createdAt, t)}
        </Text>
        <StatusPill status={project.status} />
      </View>
      <Text style={s.chevron}>›</Text>
    </View>
  );
}

function relativeDate(timestamp: number, t: TFunction) {
  const seconds = Math.max(1, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return t('time.justNow');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('time.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hoursAgo', { count: hours });
  return t('time.daysAgo', { count: Math.floor(hours / 24) });
}

function withAlpha(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return hex;
  const value = match[1];
  if (value === undefined) return hex;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    card: {
      width: '100%',
      padding: 16,
      borderRadius: radii.card,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: c.scheme === 'light' ? '#1B2540' : '#000000',
      shadowOpacity: c.scheme === 'light' ? 0.08 : 0.35,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 3,
    },
    projectRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    thumbnail: {
      width: 58,
      height: 72,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbnailPlay: {
      color: '#FFFFFF',
      fontSize: 20,
    },
    projectInfo: {
      flex: 1,
      gap: 6,
    },
    projectTitle: {
      color: c.textPrimary,
      fontWeight: '700',
      fontSize: 16,
      lineHeight: 21,
    },
    projectMeta: {
      color: c.textSecondary,
      fontSize: 12,
    },
    chevron: {
      color: c.textFaint,
      fontSize: 28,
    },
  });
}
