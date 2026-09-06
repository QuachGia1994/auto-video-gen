import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { BrandMark, ScreenBackdrop, SurfaceCard } from '../../components/ui';
import { colors } from '../../lib/theme';

const themes = ['Dark Neon', 'Light Pro'] as const;
const voices = ['Edge TTS', 'LucyLab', 'Vbee', 'ElevenLabs'] as const;

export default function SettingsScreen() {
  const backendConfigured = Boolean(process.env.EXPO_PUBLIC_MOBILE_API_URL?.trim());
  const [theme, setTheme] = useState<(typeof themes)[number]>('Dark Neon');
  const [voice, setVoice] = useState<(typeof voices)[number]>('Edge TTS');
  const [autoplay, setAutoplay] = useState(true);

  return (
    <ScreenBackdrop>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Default production</Text>
        <SurfaceCard style={styles.cardGap}>
          <Text style={styles.label}>Theme</Text>
          <View style={styles.choiceRow}>
            {themes.map((item) => (
              <Pressable key={item} onPress={() => setTheme(item)} style={[styles.choice, theme === item && styles.choiceActive]}>
                <Text style={[styles.choiceText, theme === item && styles.choiceTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Voice</Text>
          <View style={styles.voiceList}>
            {voices.map((item) => (
              <Pressable key={item} onPress={() => setVoice(item)} style={styles.voiceRow}>
                <Text style={styles.value}>{item}</Text>
                <Text style={[styles.radio, voice === item && styles.radioActive]}>{voice === item ? '●' : '○'}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.value}>Autoplay previews</Text>
            <Switch value={autoplay} onValueChange={setAutoplay} trackColor={{ true: colors.primary, false: colors.surfaceStrong }} thumbColor={colors.text} />
          </View>
        </SurfaceCard>

        <Text style={styles.sectionTitle}>Pipeline</Text>
        <SurfaceCard style={styles.cardGap}>
          <SettingRow label="Format" value="1080 × 1920" />
          <SettingRow label="Frame rate" value="60 FPS" />
          <SettingRow label="Backend" value={backendConfigured ? 'Configured' : 'Not configured'} valueColor={colors.muted} />
        </SurfaceCard>

        <Text style={styles.sectionTitle}>About</Text>
        <SurfaceCard>
          <View style={styles.aboutRow}>
            <BrandMark size={42} />
            <View>
              <Text style={styles.aboutTitle}>Auto Video Gen</Text>
              <Text style={styles.caption}>Frontend concept build</Text>
            </View>
          </View>
        </SurfaceCard>
      </ScrollView>
    </ScreenBackdrop>
  );
}

function SettingRow({ label, value, valueColor = colors.text }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 34,
    gap: 12,
  },
  sectionTitle: {
    color: colors.muted,
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
    color: colors.muted,
    fontSize: 13,
  },
  value: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  choice: {
    flex: 1,
    minHeight: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#080D16',
    borderWidth: 1,
    borderColor: colors.surfaceStrong,
  },
  choiceActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  choiceText: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 13,
  },
  choiceTextActive: {
    color: colors.text,
  },
  voiceList: {
    gap: 3,
  },
  voiceRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  radio: {
    color: colors.muted,
    fontSize: 20,
  },
  radioActive: {
    color: colors.cyan,
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
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
  },
  caption: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 3,
  },
});
