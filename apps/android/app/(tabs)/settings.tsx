import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { BrandMark, ScreenBackdrop, SurfaceCard } from '../../components/ui';
import { type Palette, type ThemeMode, radii } from '../../lib/theme';
import { useTheme } from '../../lib/theme-provider';
import { useLocale } from '../../lib/i18n';

const videoThemes = [
  { id: 'darkNeon', key: 'settings.themeDarkNeon' },
  { id: 'lightPro', key: 'settings.themeLightPro' },
] as const;
const voices = ['Edge TTS', 'LucyLab', 'Vbee', 'ElevenLabs'] as const;
const appearanceModes: ThemeMode[] = ['system', 'light', 'dark'];
const appearanceKey: Record<ThemeMode, string> = {
  system: 'appearance.system',
  light: 'appearance.light',
  dark: 'appearance.dark',
};

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { colors, mode, setMode } = useTheme();
  const { language, setLanguage, languages } = useLocale();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const backendConfigured = Boolean(process.env.EXPO_PUBLIC_MOBILE_API_URL?.trim());
  const [videoTheme, setVideoTheme] = useState<(typeof videoThemes)[number]['id']>('darkNeon');
  const [voice, setVoice] = useState<(typeof voices)[number]>('Edge TTS');
  const [autoplay, setAutoplay] = useState(true);

  return (
    <ScreenBackdrop>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 10 }]}>
        <Text style={s.pageTitle}>{t('nav.settings')}</Text>
        <Text style={s.sectionTitle}>{t('settings.appearance')}</Text>
        <SurfaceCard>
          <View style={s.segmented}>
            {appearanceModes.map((item) => {
              const active = mode === item;
              return (
                <Pressable key={item} onPress={() => setMode(item)} style={[s.segment, active && s.segmentActive]}>
                  <Text style={[s.segmentText, active && s.segmentTextActive]}>{t(appearanceKey[item])}</Text>
                </Pressable>
              );
            })}
          </View>
        </SurfaceCard>

        <Text style={s.sectionTitle}>{t('settings.language')}</Text>
        <SurfaceCard style={s.cardGap}>
          {languages.map((item) => {
            const active = language === item.code;
            return (
              <Pressable key={item.code} onPress={() => void setLanguage(item.code)} style={s.rowBetween}>
                <Text style={s.value}>{item.label}</Text>
                <Text style={[s.radio, active && s.radioActive]}>{active ? '●' : '○'}</Text>
              </Pressable>
            );
          })}
        </SurfaceCard>

        <Text style={s.sectionTitle}>{t('settings.defaultProduction')}</Text>
        <SurfaceCard style={s.cardGap}>
          <Text style={s.label}>{t('settings.videoTheme')}</Text>
          <View style={s.choiceRow}>
            {videoThemes.map((item) => {
              const active = videoTheme === item.id;
              return (
                <Pressable key={item.id} onPress={() => setVideoTheme(item.id)} style={[s.choice, active && s.choiceActive]}>
                  <Text style={[s.choiceText, active && s.choiceTextActive]}>{t(item.key)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={s.label}>{t('settings.voice')}</Text>
          <View style={s.voiceList}>
            {voices.map((item) => (
              <Pressable key={item} onPress={() => setVoice(item)} style={s.rowBetween}>
                <Text style={s.value}>{item}</Text>
                <Text style={[s.radio, voice === item && s.radioActive]}>{voice === item ? '●' : '○'}</Text>
              </Pressable>
            ))}
          </View>

          <View style={s.switchRow}>
            <Text style={s.value}>{t('settings.autoplay')}</Text>
            <Switch
              value={autoplay}
              onValueChange={setAutoplay}
              trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
              thumbColor="#FFFFFF"
            />
          </View>
        </SurfaceCard>

        <Text style={s.sectionTitle}>{t('settings.pipeline')}</Text>
        <SurfaceCard style={s.cardGap}>
          <SettingRow s={s} label={t('settings.format')} value="1080 × 1920" />
          <SettingRow s={s} label={t('settings.frameRate')} value="60 FPS" />
          <SettingRow
            s={s}
            label={t('settings.backend')}
            value={backendConfigured ? t('settings.configured') : t('settings.notConfigured')}
            valueColor={colors.textSecondary}
          />
        </SurfaceCard>

        <Text style={s.sectionTitle}>{t('settings.about')}</Text>
        <SurfaceCard>
          <View style={s.aboutRow}>
            <BrandMark size={42} />
            <View>
              <Text style={s.aboutTitle}>Auto Video Gen</Text>
              <Text style={s.caption}>{t('settings.aboutTagline')}</Text>
            </View>
          </View>
        </SurfaceCard>
      </ScrollView>
    </ScreenBackdrop>
  );
}

function SettingRow({
  s,
  label,
  value,
  valueColor,
}: {
  s: ReturnType<typeof makeStyles>;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={s.settingRow}>
      <Text style={s.label}>{label}</Text>
      <Text style={[s.value, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    content: {
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 34,
      gap: 12,
    },
    pageTitle: {
      color: c.textPrimary,
      fontSize: 26,
      fontWeight: '900',
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    sectionTitle: {
      color: c.textSecondary,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: 8,
    },
    cardGap: {
      gap: 14,
    },
    label: {
      color: c.textSecondary,
      fontSize: 13,
    },
    value: {
      color: c.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    segmented: {
      flexDirection: 'row',
      gap: 6,
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
    },
    segmentText: {
      color: c.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    segmentTextActive: {
      color: '#FFFFFF',
    },
    choiceRow: {
      flexDirection: 'row',
      gap: 8,
    },
    choice: {
      flex: 1,
      minHeight: 40,
      borderRadius: radii.small,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.inputBg,
      borderWidth: 1,
      borderColor: c.border,
    },
    choiceActive: {
      backgroundColor: c.accent,
      borderColor: c.accent,
    },
    choiceText: {
      color: c.textSecondary,
      fontWeight: '700',
      fontSize: 13,
    },
    choiceTextActive: {
      color: '#FFFFFF',
    },
    voiceList: {
      gap: 3,
    },
    rowBetween: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    radio: {
      color: c.textFaint,
      fontSize: 20,
    },
    radioActive: {
      color: c.accentAlt,
    },
    switchRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    settingRow: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    aboutRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    aboutTitle: {
      color: c.textPrimary,
      fontWeight: '800',
      fontSize: 16,
    },
    caption: {
      color: c.textSecondary,
      fontSize: 12,
      marginTop: 3,
    },
  });
}
