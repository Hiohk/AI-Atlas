"use client";

import { createContext, useContext } from "react";
import type { Dictionary, Locale, ThemePreference } from "@/lib/i18n/dictionary";
import { en } from "@/lib/i18n/dictionary";

export type PreferencesValue = {
  locale: Locale;
  theme: ThemePreference;
  dictionary: Dictionary;
};

const PreferencesContext = createContext<PreferencesValue>({
  locale: "en",
  theme: "system",
  dictionary: en,
});

export function PreferencesProvider({
  locale,
  theme,
  dictionary,
  children,
}: PreferencesValue & { children: React.ReactNode }) {
  return (
    <PreferencesContext.Provider value={{ locale, theme, dictionary }}>{children}</PreferencesContext.Provider>
  );
}

export function useDictionary(): Dictionary {
  return useContext(PreferencesContext).dictionary;
}

export function useLocale(): Locale {
  return useContext(PreferencesContext).locale;
}

export function useThemePreference(): ThemePreference {
  return useContext(PreferencesContext).theme;
}
