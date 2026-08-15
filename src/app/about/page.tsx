import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { AvatarStack, Card, Eyebrow, IconTile, Panel, SectionHeading } from "@/components/ui/primitives";
import { accent } from "@/lib/accents";
import { listContributors } from "@/lib/auth/session";
import { siteConfig } from "@/lib/config";
import { getPlatformStats, getResourceTypes } from "@/lib/queries/resources";
import { listTopics } from "@/lib/queries/topics";
import { getDictionary } from "@/lib/i18n";
import { formatMessage, pluralNoun } from "@/lib/i18n/dictionary";
import { cn, compactNumber } from "@/lib/utils";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "About",
  description:
    "How AI Atlas works: what gets curated, how resources are reviewed and scored, and how to contribute to the map.",
};

const VALUE_PROP_META: Array<{ icon: IconName; accent: string; titleKey: "qualityTitle" | "communityTitle" | "freshTitle"; bodyKey: "qualityBody" | "communityBody" | "freshBody" }> = [
  { icon: "shield-check", accent: "indigo", titleKey: "qualityTitle", bodyKey: "qualityBody" },
  { icon: "users", accent: "violet", titleKey: "communityTitle", bodyKey: "communityBody" },
  { icon: "trending-up", accent: "emerald", titleKey: "freshTitle", bodyKey: "freshBody" },
];

const PIPELINE: Array<{ title: string; body: string }> = [
  { title: "URL submitted", body: "One link is all we ask for — no forms full of metadata to fill in." },
  { title: "SSRF-validated fetch", body: "The URL is resolved and checked before anything is fetched from it." },
  { title: "Metadata extraction", body: "Title, author, publication date, canonical URL and media are parsed." },
  { title: "AI classification", body: "The model assigns topics, difficulty and format, then writes a structured analysis." },
  { title: "Duplicate detection", body: "Three layers — canonical URL, content hash and semantic similarity." },
  { title: "Editorial review", body: "A human editor makes the final call before it is published." },
];

const SCORE_WEIGHTS: Array<{ label: string; weight: number }> = [
  { label: "Authority", weight: 20 },
  { label: "Technical Depth", weight: 20 },
  { label: "Originality", weight: 15 },
  { label: "Freshness", weight: 15 },
  { label: "Community", weight: 15 },
  { label: "Editorial", weight: 15 },
];

const SCORE_BANDS: Array<{ range: string; label: string; className: string }> = [
  { range: "0–59", label: "Low", className: "bg-slate-100 text-slate-700" },
  { range: "60–74", label: "Average", className: "bg-amber-50 text-amber-700" },
  { range: "75–89", label: "Good", className: "bg-brand-50 text-brand-700" },
  { range: "90–100", label: "Excellent", className: "bg-emerald-50 text-emerald-700" },
];

const QUOTAS: Array<{ tier: string; limit: string }> = [
  { tier: "New accounts", limit: "10 submissions / day" },
  { tier: "Contributors", limit: "50 submissions / day" },
  { tier: "Trusted contributors", limit: "100+ submissions / day" },
];

export default async function AboutPage() {
  const [stats, topics, contributors, types, dict] = await Promise.all([
    getPlatformStats(),
    listTopics({ featuredOnly: true, limit: 6 }),
    listContributors(8),
    getResourceTypes(),
    getDictionary(),
  ]);

  const headlineStats = [
    { label: dict.common.resources, value: stats.resources, icon: "layers" as IconName },
    { label: dict.common.contributors, value: stats.contributors, icon: "users" as IconName },
    { label: dict.common.learners, value: stats.learners, icon: "graduation-cap" as IconName },
    { label: dict.about.countries, value: siteConfig.reachCountries, icon: "network" as IconName },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-14 px-4 py-10 sm:px-6 lg:px-8">
      <Panel className="relative overflow-hidden bg-hero-mesh p-8 sm:p-10">
        <div className="absolute inset-0 bg-grid-faint opacity-40" aria-hidden />
        <div className="relative max-w-2xl">
          <Eyebrow icon="compass">{dict.about.eyebrow}</Eyebrow>
          <h1 className="animate-rise mt-3 text-3xl font-semibold tracking-[-0.02em] text-balance-tight text-ink sm:text-4xl">
            {dict.about.title}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">{dict.about.hero}</p>
        </div>
      </Panel>

      <section>
        <div className="grid gap-3 sm:grid-cols-3">
          {VALUE_PROP_META.map((prop) => (
            <Card key={prop.titleKey} className="p-5">
              <IconTile icon={prop.icon} accent={prop.accent} />
              <h2 className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-ink">{dict.about[prop.titleKey]}</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{dict.about[prop.bodyKey]}</p>
            </Card>
          ))}
        </div>
      </section>

      <section aria-label="Platform statistics">
        <Card className="grid grid-cols-2 divide-hairline sm:grid-cols-4 sm:divide-x">
          {headlineStats.map((stat) => (
            <div key={stat.label} className="px-5 py-6 text-center">
              <p className="text-2xl font-semibold tracking-[-0.02em] text-ink tabular-nums sm:text-3xl">
                {compactNumber(stat.value)}
              </p>
              <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
                <Icon name={stat.icon} className="size-3.5" />
                {stat.label}
              </p>
            </div>
          ))}
        </Card>
        <p className="mt-2 text-center text-xs text-muted">{dict.about.liveCounts}</p>
      </section>

      <section className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        <div>
          <SectionHeading eyebrow={dict.about.storyEyebrow} eyebrowIcon="book-open" title={dict.about.storyTitle} />
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted">
            <p>{dict.about.story1}</p>
            <p>{dict.about.story2}</p>
          </div>
        </div>
        <Card className="p-5">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">{dict.about.featuredTopics}</p>
          <div className="mt-3.5 space-y-2">
            {topics.map((topic) => (
              <Link
                key={topic.slug}
                href={`/topics/${topic.slug}`}
                className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-hover"
              >
                <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg", accent(topic.accent).tile)}>
                  <Icon name={topic.icon} className="size-4" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{topic.name}</span>
                  <span className="block truncate text-[11px] text-muted">
                    {topic.resourceCount} {pluralNoun(dict, topic.resourceCount, "resource")}
                  </span>
                </span>
                <Icon name="chevron-right" className="size-3.5 text-slate-400" />
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <section id="quality" className="scroll-mt-24">
        <SectionHeading
          eyebrow={dict.about.qualityEyebrow}
          eyebrowIcon="shield-check"
          title={dict.about.howTitle}
          description={dict.about.howDescription}
        />
        <ol className="mt-5 space-y-2.5">
          {PIPELINE.map((step, index) => (
            <li key={step.title}>
              <Card className="flex items-start gap-4 p-4">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-[13px] font-semibold text-brand-700 tabular-nums">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{step.title}</span>
                  <span className="mt-0.5 block text-[13px] text-muted">{step.body}</span>
                </span>
              </Card>
            </li>
          ))}
        </ol>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Card className="p-5">
            <h3 className="text-sm font-semibold tracking-[-0.01em] text-ink">{dict.about.weightsTitle}</h3>
            <dl className="mt-3 divide-y divide-hairline">
              {SCORE_WEIGHTS.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4 py-2">
                  <dt className="text-[13px] text-muted">{item.label}</dt>
                  <dd className="text-[13px] font-semibold text-ink tabular-nums">{item.weight}%</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card className="p-5">
            <h3 className="text-sm font-semibold tracking-[-0.01em] text-ink">{dict.about.bandsTitle}</h3>
            <dl className="mt-3 divide-y divide-hairline">
              {SCORE_BANDS.map((band) => (
                <div key={band.label} className="flex items-center justify-between gap-4 py-2">
                  <dt className="font-mono text-[13px] text-muted tabular-nums">{band.range}</dt>
                  <dd>
                    <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", band.className)}>{band.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </section>

      <section id="contributing" className="scroll-mt-24">
        <SectionHeading
          eyebrow="Contribute"
          eyebrowIcon="plus"
          title="Submitting takes one URL"
          description="Paste a link and the pipeline does the rest — extraction, classification, deduplication and scoring."
        />
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-stretch">
          <Card className="p-5">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Daily submission quotas</p>
            <dl className="mt-3 divide-y divide-hairline">
              {QUOTAS.map((quota) => (
                <div key={quota.tier} className="flex items-center justify-between gap-4 py-2">
                  <dt className="text-[13px] text-muted">{quota.tier}</dt>
                  <dd className="text-[13px] font-semibold text-ink">{quota.limit}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted">
              Quotas rise as your submissions are accepted, which keeps the review queue readable for editors.
            </p>
          </Card>
          <Card className="flex flex-col justify-between gap-4 bg-brand-50/50 p-5 sm:w-64">
            <div>
              <p className="text-sm font-semibold text-brand-800">Join the contributors</p>
              <p className="mt-1 text-[13px] text-muted">
                {compactNumber(stats.contributors)} people have added to the map so far.
              </p>
              <div className="mt-3">
                <AvatarStack people={contributors} max={5} extra={Math.max(0, stats.contributors - 5)} />
              </div>
            </div>
            <ButtonLink href="/submit" size="md" className="w-full">
              <Icon name="plus" className="size-4" />
              Submit a resource
            </ButtonLink>
          </Card>
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Formats"
          eyebrowIcon="layers"
          title="What lives on the map"
          description="Some things are best learned from a paper, others from a repo you can run."
        />
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {types.map((type) => (
            <Link key={type.slug} href={`/resources?type=${type.slug}`} className="group">
              <Card className="flex h-full items-center gap-3 p-3.5 transition-shadow hover:shadow-lift">
                <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-lg", accent(type.accent).tile)}>
                  <Icon name={type.icon} className="size-4" strokeWidth={1.9} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-ink group-hover:text-brand-700">
                    {type.pluralName}
                  </span>
                  <span className="block text-[11px] text-muted tabular-nums">{compactNumber(type.count)}</span>
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <Panel className="bg-brand-50/50 px-6 py-8 text-center sm:px-8">
        <h2 className="text-lg font-semibold tracking-[-0.01em] text-brand-800">Start exploring the map</h2>
        <p className="mx-auto mt-1.5 max-w-lg text-sm text-muted">
          Browse what is already here, or add the resource you wish you had found sooner.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          <ButtonLink href="/submit" size="md">
            <Icon name="plus" className="size-4" />
            Submit a Resource
          </ButtonLink>
          <ButtonLink href={siteConfig.repository} variant="outline" size="md">
            <Icon name="github" className="size-4" />
            View on GitHub
          </ButtonLink>
        </div>
      </Panel>
    </div>
  );
}
