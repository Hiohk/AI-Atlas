import type { Metadata } from "next";
import Link from "next/link";
import { TopicCard } from "@/components/topic/topic-card";
import { Icon } from "@/components/ui/icon";
import { Card, EmptyState, SectionHeading } from "@/components/ui/primitives";
import { getResourceTypes } from "@/lib/queries/resources";
import { listTopics } from "@/lib/queries/topics";
import { accent } from "@/lib/accents";
import { getDictionary } from "@/lib/i18n";
import { formatMessage } from "@/lib/i18n/dictionary";
import { cn, compactNumber } from "@/lib/utils";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Explore AI topics",
  description:
    "Browse the AI landscape by topic: LLMs, agents, RAG, AI engineering, multimodal, safety, infrastructure and more.",
};

export default async function ExplorePage() {
  const [topics, types, dict] = await Promise.all([listTopics({ topLevelOnly: true }), getResourceTypes(), getDictionary()]);

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink">{dict.explore.title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{dict.explore.subtitle}</p>
      </header>

      <section>
        <SectionHeading
          eyebrow={dict.explore.topicsEyebrow}
          eyebrowIcon="compass"
          title={dict.explore.topicsTitle}
          description={formatMessage(dict.explore.topicsDescription, { count: topics.length })}
        />
        {topics.length === 0 ? (
          <EmptyState className="mt-5" title={dict.explore.emptyTitle} description={dict.explore.emptyBody} />
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {topics.map((topic) => (
              <TopicCard key={topic.slug} topic={topic} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading
          eyebrow={dict.explore.formatsEyebrow}
          eyebrowIcon="layers"
          title={dict.explore.formatsTitle}
          description={dict.explore.formatsDescription}
        />
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {types
            .filter((type) => type.count > 0)
            .map((type) => (
              <Link key={type.slug} href={`/resources?type=${type.slug}`} className="group">
                <Card className="flex h-full items-start gap-3 p-4 transition-shadow hover:shadow-lift">
                  <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-xl", accent(type.accent).tile)}>
                    <Icon name={type.icon} className="size-5" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink group-hover:text-brand-700">
                      {dict.typesPlural[type.slug as keyof typeof dict.typesPlural] ?? type.pluralName}
                    </span>
                    <span className="mt-0.5 block line-clamp-2 text-xs text-muted">{type.description}</span>
                    <span className={cn("mt-2 block text-xs font-semibold", accent(type.accent).text)}>
                      {formatMessage(dict.explore.available, { count: compactNumber(type.count) })}
                    </span>
                  </span>
                </Card>
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}
