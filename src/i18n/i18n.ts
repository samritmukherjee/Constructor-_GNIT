import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './locales/en.json';
import bn from './locales/bn.json';
import hi from './locales/hi.json';

const LANGUAGE_KEY = '@app_language';

// Initialize i18n synchronously first
i18n.use(initReactI18next).init({
  compatibilityJSON: 'v3',
  resources: {
    en: { translation: en },
    bn: { translation: bn },
    hi: { translation: hi },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

// Load saved language asynchronously after init
export const loadLanguage = async () => {
  try {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (savedLanguage && i18n.isInitialized) {
      await i18n.changeLanguage(savedLanguage);
    }
  } catch (error) {
    console.error('Error loading language:', error);
  }
};

// Save language preference
export const saveLanguage = async (language: string) => {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, language);
    // Immediately change language after saving
    if (i18n.isInitialized) {
      await i18n.changeLanguage(language);
    }
  } catch (error) {
    console.error('Error saving language:', error);
  }
};

export default i18n;
