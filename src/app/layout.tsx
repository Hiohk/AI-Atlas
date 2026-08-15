import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { PreferencesProvider } from "@/components/providers/preferences-provider";
import { getCurrentUser } from "@/lib/auth/session";
import { siteConfig } from "@/lib/config";
import { getDictionary, getLocale, getThemePreference, THEME_BOOTSTRAP } from "@/lib/i18n";
import { localeTag } from "@/lib/i18n/dictionary";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: `${siteConfig.name} — ${dict.meta.tagline}`,
      template: `%s · ${siteConfig.name}`,
    },
    description: dict.meta.description,
    keywords: ["AI", "LLM", "AI engineering", "machine learning", "learning resources", "AI papers", "RAG", "AI agents"],
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      title: `${siteConfig.name} — ${dict.meta.tagline}`,
      description: dict.meta.description,
      url: siteConfig.url,
    },
    twitter: { card: "summary_large_image" },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#4f46e5" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d14" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, locale, theme, dictionary] = await Promise.all([
    getCurrentUser(),
    getLocale(),
    getThemePreference(),
    getDictionary(),
  ]);

  return (
    <html lang={localeTag(locale)} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {THEME_BOOTSTRAP}
        </Script>
        <PreferencesProvider locale={locale} theme={theme} dictionary={dictionary}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
          >
            {dictionary.nav.skip}
          </a>
          <SiteHeader user={user} />
          <main id="main" className="min-h-[70vh]">
            {children}
          </main>
          <SiteFooter />
        </PreferencesProvider>
      </body>
    </html>
  );
}
