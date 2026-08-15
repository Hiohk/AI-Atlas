"use client";

import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { useDictionary } from "@/components/providers/preferences-provider";
import { Icon } from "@/components/ui/icon";
import { siteConfig } from "@/lib/config";
import { formatMessage } from "@/lib/i18n/dictionary";

export function SiteFooter() {
  const dict = useDictionary();
  const columns = [
    {
      title: dict.footer.discover,
      links: [
        { href: "/explore", label: dict.footer.exploreTopics },
        { href: "/resources", label: dict.footer.allResources },
        { href: "/trending", label: dict.footer.trending },
        { href: "/search", label: dict.footer.search },
      ],
    },
    {
      title: dict.footer.learn,
      links: [
        { href: "/paths", label: dict.footer.learningPaths },
        { href: "/paths/llm-application-engineer", label: dict.footer.llmEngineer },
        { href: "/paths/ai-agent-builder", label: dict.footer.agents },
        { href: "/me", label: dict.footer.myLibrary },
      ],
    },
    {
      title: dict.footer.contribute,
      links: [
        { href: "/submit", label: dict.footer.submit },
        { href: "/about#contributing", label: dict.footer.contributionGuide },
        { href: "/about#quality", label: dict.footer.qualityStandards },
      ],
    },
    {
      title: dict.footer.topics,
      links: [
        { href: "/topics/llm", label: "LLM" },
        { href: "/topics/agents", label: "Agents" },
        { href: "/topics/rag", label: "RAG" },
        { href: "/topics/ai-engineering", label: "AI Engineering" },
      ],
    },
  ];

  return (
    <footer className="mt-20 border-t border-hairline bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-sm leading-relaxed text-muted">{dict.footer.blurb}</p>
            <Link
              href={siteConfig.repository}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
            >
              <Icon name="github" className="size-4" />
              {dict.footer.github}
            </Link>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <p className="text-[11px] font-semibold tracking-[0.12em] text-ink uppercase">{column.title}</p>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-muted transition-colors hover:text-brand-600">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-6 text-xs text-muted">
          <p>{formatMessage(dict.footer.copyright, { year: new Date().getFullYear() })}</p>
          <p className="flex items-center gap-1.5">
            <Icon name="shield-check" className="size-3.5" />
            {dict.footer.reviewed}
          </p>
        </div>
      </div>
    </footer>
  );
}
