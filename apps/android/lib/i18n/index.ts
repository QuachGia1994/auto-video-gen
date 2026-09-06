import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type AppLanguage, LANGUAGES, resources } from './resources';

const STORAGE_KEY = '@avg/language';
const SUPPORTED: AppLanguage[] = ['vi', 'en', 'zh', 'ja', 'fr'];

function deviceLanguage(): AppLanguage {
  const code = Localization.getLocales()[0]?.languageCode?.toLowerCase();
  return (SUPPORTED as string[]).includes(code ?? '') ? (code as AppLanguage) : 'en';
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: deviceLanguage(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export async function loadPersistedLanguage(): Promise<void> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored && (SUPPORTED as string[]).includes(stored)) {
    await i18n.changeLanguage(stored);
  }
}

export async function changeLanguage(lang: AppLanguage): Promise<void> {
  await i18n.changeLanguage(lang);
  await AsyncStorage.setItem(STORAGE_KEY, lang);
}

export function useLocale() {
  const { i18n: instance } = useTranslation();
  return {
    language: (instance.language as AppLanguage) ?? 'en',
    setLanguage: changeLanguage,
    languages: LANGUAGES,
  };
}

export default i18n;
