import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { localeTag, type Locale } from "@/lib/i18n/dictionary";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 12480 → "12.5k". Used everywhere counts are displayed in a tight space. */
export function compactNumber(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k < 10 ? k.toFixed(1).replace(/\.0$/, "") : Math.round(k)}k`;
  }
  const m = n / 1_000_000;
  return `${m < 10 ? m.toFixed(1).replace(/\.0$/, "") : Math.round(m)}M`;
}

export function formatMinutes(minutes: number | null | undefined, locale: Locale = "en"): string | null {
  if (!minutes) return null;
  if (locale === "zh") {
    if (minutes < 60) return `${minutes} 分钟`;
    const hours = minutes / 60;
    if (hours < 8) {
      const rounded = Math.round(hours * 2) / 2;
      return `${rounded === Math.floor(rounded) ? rounded : rounded.toFixed(1)} 小时`;
    }
    if (hours < 60) return `${Math.round(hours)} 小时`;
    return `${Math.round(hours / 8)} 天`;
  }
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  if (hours < 8) {
    const rounded = Math.round(hours * 2) / 2;
    return `${rounded === Math.floor(rounded) ? rounded : rounded.toFixed(1)}${rounded === 1 ? " hour" : " hours"}`;
  }
  if (hours < 60) return `${Math.round(hours)} hours`;
  return `${Math.round(hours / 8)} days of study`;
}

export function formatDate(value: Date | string | null | undefined, locale: Locale = "en"): string | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(localeTag(locale), { year: "numeric", month: "short", day: "numeric" });
}

export function relativeTime(value: Date | string | null | undefined, locale: Locale = "en"): string | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  const seconds = (Date.now() - date.getTime()) / 1000;
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3600],
    ["minute", 60],
  ];
  const formatter = new Intl.RelativeTimeFormat(localeTag(locale), { numeric: "auto" });
  for (const [unit, secondsPerUnit] of units) {
    if (Math.abs(seconds) >= secondsPerUnit) {
      return formatter.format(-Math.round(seconds / secondsPerUnit), unit);
    }
  }
  return locale === "zh" ? "刚刚" : "just now";
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${compactNumber(count)} ${count === 1 ? singular : plural}`;
}

/** Builds a query string while dropping empty values and default pages. */
export function buildQuery(
  base: Record<string, string | string[] | number | undefined | null>,
  overrides: Record<string, string | string[] | number | undefined | null> = {},
): string {
  const params = new URLSearchParams();
  const merged = { ...base, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) continue;
    if (key === "page" && String(value) === "1") continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, String(item));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
