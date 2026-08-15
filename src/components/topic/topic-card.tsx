"use client";

import Link from "next/link";
import { useDictionary } from "@/components/providers/preferences-provider";
import { Icon } from "@/components/ui/icon";
import { Card, IconTile } from "@/components/ui/primitives";
import { accent } from "@/lib/accents";
import { pluralNoun } from "@/lib/i18n/dictionary";
import type { TopicSummary } from "@/lib/queries/topics";
import { cn, compactNumber } from "@/lib/utils";

export function TopicCard({ topic, className }: { topic: TopicSummary; className?: string }) {
  const dict = useDictionary();
  const tone = accent(topic.accent);
  return (
    <Link href={`/topics/${topic.slug}`} className={cn("group block", className)}>
      <Card className="relative flex h-full flex-col p-4 transition-shadow hover:shadow-lift">
        <Icon
          name="arrow-up-right"
          className="absolute top-4 right-4 size-3.5 text-slate-300 transition-colors group-hover:text-brand-500"
        />
        <IconTile icon={topic.icon} accent={topic.accent} />
        <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-ink group-hover:text-brand-700">
          {topic.shortName ?? topic.name}
        </h3>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">{topic.tagline ?? topic.name}</p>
        <p className={cn("mt-4 text-xs font-semibold", tone.text)}>
          {compactNumber(topic.resourceCount)} {pluralNoun(dict, topic.resourceCount, "resource")}
        </p>
      </Card>
    </Link>
  );
}

/** Sidebar list entry for subtopics, as on the topic detail page. */
export function SubtopicLink({
  href,
  name,
  count,
  active = false,
}: {
  href: string;
  name: string;
  count: number;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
        active ? "bg-brand-50 font-medium text-brand-700" : "text-muted hover:bg-hover hover:text-ink",
      )}
    >
      <span className="truncate">{name}</span>
      <span className={cn("shrink-0 text-[11px] tabular-nums", active ? "text-brand-600" : "text-slate-400")}>
        {compactNumber(count)}
      </span>
    </Link>
  );
}
