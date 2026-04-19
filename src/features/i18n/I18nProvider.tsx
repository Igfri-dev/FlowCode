"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  formatTranslation,
  resolveLanguage,
  translations,
  type Language,
  type TranslationKey,
} from "./translations";

const languageStorageKey = "flowcode-language";

type TranslateOptions = Record<string, string | number>;

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, values?: TranslateOptions) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const hasLoadedLanguageRef = useRef(false);
  const [language, setLanguageState] = useState<Language>("es");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedLanguage = window.localStorage.getItem(languageStorageKey);
      const browserLanguage = window.navigator.language;
      const resolvedLanguage = resolveLanguage(
        storedLanguage ?? browserLanguage,
      );

      hasLoadedLanguageRef.current = true;
      document.documentElement.lang = resolvedLanguage;
      window.localStorage.setItem(languageStorageKey, resolvedLanguage);

      setLanguageState((currentLanguage) =>
        currentLanguage === resolvedLanguage
          ? currentLanguage
          : resolvedLanguage,
      );
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!hasLoadedLanguageRef.current) {
      return;
    }

    document.documentElement.lang = language;
    window.localStorage.setItem(languageStorageKey, language);
  }, [language]);

  const setLanguage = useCallback((nextLanguage: Language) => {
    hasLoadedLanguageRef.current = true;
    setLanguageState(nextLanguage);
  }, []);

  const t = useCallback(
    (key: TranslationKey, values?: TranslateOptions) => {
      const text = translations[language][key] ?? translations.es[key] ?? key;

      return values ? formatTranslation(text, values) : text;
    },
    [language],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t,
    }),
    [language, setLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider.");
  }

  return context;
}
