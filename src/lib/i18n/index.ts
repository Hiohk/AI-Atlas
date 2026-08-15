import { cookies } from "next/headers";
import { dictionaries, isLocale, type Dictionary, type Locale, type ThemePreference } from "./dictionary";

export const LOCALE_COOKIE = "atlas-locale";
export const THEME_COOKIE = "atlas-theme";
export const PREFERENCE_MAX_AGE = 60 * 60 * 24 * 365;

export function isTheme(value: string | undefined | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const value = jar.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "en";
}

export async function getThemePreference(): Promise<ThemePreference> {
  const jar = await cookies();
  const value = jar.get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : "system";
}

export async function getDictionary(): Promise<Dictionary> {
  return dictionaries[await getLocale()];
}

/** Inline script that paints the correct theme before first paint. */
export const THEME_BOOTSTRAP = `(function(){
  try {
    var match = document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);
    var theme = match ? decodeURIComponent(match[1]) : "system";
    var dark = theme === "dark" || (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();`;
