"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setLocaleAction, setThemeAction } from "@/app/actions/preferences";
import { Icon } from "@/components/ui/icon";
import { useDictionary, useLocale, useThemePreference } from "@/components/providers/preferences-provider";
import type { Locale, ThemePreference } from "@/lib/i18n/dictionary";
import { LOCALES } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";

function applyThemeClass(theme: ThemePreference) {
  const dark =
    theme === "dark" || (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function LocaleToggle() {
  const locale = useLocale();
  const dict = useDictionary();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  return (
    <div className="inline-flex items-center rounded-lg border border-hairline bg-surface p-0.5" role="group" aria-label={dict.prefs.language}>
      {LOCALES.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={pending}
          onClick={() => choose(option.value)}
          className={cn(
            "rounded-md px-2 py-1 text-[11px] font-semibold tracking-wide transition-colors",
            locale === option.value ? "bg-brand-600 text-white" : "text-muted hover:text-ink",
          )}
        >
          {option.short}
        </button>
      ))}
    </div>
  );
}

const THEMES: Array<{ value: ThemePreference; icon: "sun" | "moon" | "monitor" }> = [
  { value: "light", icon: "sun" },
  { value: "dark", icon: "moon" },
  { value: "system", icon: "monitor" },
];

export function ThemeToggle() {
  const current = useThemePreference();
  const dict = useDictionary();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const labels: Record<ThemePreference, string> = {
    light: dict.prefs.light,
    dark: dict.prefs.dark,
    system: dict.prefs.system,
  };
  const activeIcon = THEMES.find((item) => item.value === current)?.icon ?? "monitor";

  function choose(next: ThemePreference) {
    applyThemeClass(next);
    setOpen(false);
    startTransition(async () => {
      await setThemeAction(next);
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={dict.prefs.theme}
        aria-expanded={open}
        disabled={pending}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink"
      >
        <Icon name={activeIcon} className="size-4" />
      </button>
      {open ? (
        <div className="absolute top-full right-0 z-50 mt-1.5 w-36 overflow-hidden rounded-xl border border-hairline bg-surface p-1 shadow-lift">
          {THEMES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => choose(option.value)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
                current === option.value ? "bg-brand-50 text-brand-700" : "text-ink hover:bg-hover",
              )}
            >
              <Icon name={option.icon} className="size-3.5" />
              {labels[option.value]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
