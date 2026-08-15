"use server";

import { cookies } from "next/headers";
import { isLocale } from "@/lib/i18n/dictionary";
import { isTheme, LOCALE_COOKIE, PREFERENCE_MAX_AGE, THEME_COOKIE } from "@/lib/i18n";

function cookieOptions() {
  return { path: "/", maxAge: PREFERENCE_MAX_AGE, sameSite: "lax" as const };
}

export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, cookieOptions());
}

export async function setThemeAction(theme: string) {
  if (!isTheme(theme)) return;
  const jar = await cookies();
  jar.set(THEME_COOKIE, theme, cookieOptions());
}
