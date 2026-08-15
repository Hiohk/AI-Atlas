import type { Metadata } from "next";
import Link from "next/link";
import { ResourceMiniRow } from "@/components/resource/resource-card";
import { ButtonLink } from "@/components/ui/button";
import { AttentionHeatmap, GrowthBadge, Sparkline } from "@/components/ui/charts";
import { Icon } from "@/components/ui/icon";
import { Callout, Card, EmptyState, Eyebrow, IconTile, Panel, SectionHeading } from "@/components/ui/primitives";
import { listResources } from "@/lib/queries/resources";
import {
  getAttentionHeatmap,
  getTopicGaps,
  getTrendingResources,
  getTrendingTopics,
  TRENDING_WINDOWS,
  type TrendingWindow,
} from "@/lib/queries/trending";
import { accent } from "@/lib/accents";
import { getDictionary } from "@/lib/i18n";
import { formatMessage, pluralNoun, windowLabel } from "@/lib/i18n/dictionary";
import { cn, compactNumber } from "@/lib/utils";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Trending in AI",
  description:
    "What the community is reading right now: topics accelerating fastest, resources gaining attention, and the questions the atlas cannot yet answer.",
};

function parseWindow(value: string | undefined): TrendingWindow {
  const parsed = Number(value);
  return TRENDING_WINDOWS.some((option) => option.value === parsed) ? (parsed as TrendingWindow) : 7;
}

const TABS = [
  { value: "rising", label: "Rising topics" },
  { value: "saved", label: "Most saved" },
  { value: "new", label: "New this week" },
] as const;

type TrendingTab = (typeof TABS)[number]["value"];

export default async function TrendingPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const windowDays = parseWindow(params.window);
  const tab: TrendingTab = TABS.some((option) => option.value === params.tab) ? (params.tab as TrendingTab) : "rising";

  const [topics, resources, gaps, heatmap, newest, dict] = await Promise.all([
    getTrendingTopics(windowDays, 10),
    getTrendingResources(windowDays, 10),
    getTopicGaps(6),
    getAttentionHeatmap(35, 8),
    tab === "new" ? listResources({ sort: "newest", perPage: 10 }) : Promise.resolve(null),
    getDictionary(),
  ]);

  const mostSaved = [...resources].sort((a, b) => b.savesCount - a.savesCount || b.windowSaves - a.windowSaves);

  const label = windowLabel(dict, windowDays);
  const risingFastest = topics[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <Eyebrow icon="trending-up">{dict.trendingPage.eyebrow}</Eyebrow>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-ink">{dict.trendingPage.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">{dict.trendingPage.subtitle}</p>
        </div>

        <div className="flex items-center gap-1 rounded-full border border-hairline bg-surface p-1">
          {TRENDING_WINDOWS.map((option) => {
            const search = new URLSearchParams();
            if (option.value !== 7) search.set("window", String(option.value));
            if (tab !== "rising") search.set("tab", tab);
            const href = search.toString() ? `/trending?${search}` : "/trending";
            return (
              <Link
                key={option.value}
                href={href}
                className={cn(
                  "rounded-full px-3 py-1 text-[12px] font-medium transition",
                  option.value === windowDays ? "bg-brand-600 text-white" : "text-muted hover:text-ink",
                )}
              >
                {windowLabel(dict, option.value)}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {TABS.map((option) => {
          const search = new URLSearchParams();
          if (windowDays !== 7) search.set("window", String(windowDays));
          if (option.value !== "rising") search.set("tab", option.value);
          const href = search.toString() ? `/trending?${search}` : "/trending";
          return (
            <Link
              key={option.value}
              href={href}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[13px] font-medium transition",
                tab === option.value
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-hairline bg-surface text-muted hover:text-ink",
              )}
            >
              {option.value === "rising"
                ? dict.trendingPage.rising
                : option.value === "saved"
                  ? dict.trendingPage.saved
                  : dict.trendingPage.newest}
            </Link>
          );
        })}
      </div>

      {risingFastest && (
        <Card className="mt-6 overflow-hidden bg-hero-mesh p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <IconTile icon={risingFastest.icon} accent={risingFastest.accent} size="lg" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  {formatMessage(dict.trendingPage.risingFastest, { label })}
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.01em] text-ink">
                  <Link href={`/topics/${risingFastest.slug}`} className="hover:text-brand-700">
                    {risingFastest.name}
                  </Link>
                </h2>
                {risingFastest.tagline && <p className="mt-1 max-w-xl text-[13px] text-muted">{risingFastest.tagline}</p>}
                <div className="mt-2 flex items-center gap-3 text-[12px] text-muted">
                  <GrowthBadge value={risingFastest.growth} />
                  <span className="tabular-nums">{compactNumber(risingFastest.views)} views</span>
                  <span className="tabular-nums">
                    {risingFastest.resourceCount} {pluralNoun(dict, risingFastest.resourceCount, "resource")}
                  </span>
                </div>
              </div>
            </div>
            <Sparkline
              values={risingFastest.spark}
              width={160}
              height={44}
              strokeClassName={accent(risingFastest.accent).text.replace("text-", "stroke-")}
            />
          </div>
        </Card>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_1fr]">
        <section>
          {tab === "saved" ? (
            <>
              <SectionHeading title={dict.trendingPage.mostSavedTitle} description={formatMessage(dict.trendingPage.mostSavedDescription, { label })} />
              {mostSaved.length === 0 ? (
                <EmptyState className="mt-4" icon="bookmark" title={dict.trendingPage.noSaves} />
              ) : (
                <ul className="mt-4 space-y-1 rounded-card border border-hairline bg-surface p-2">
                  {mostSaved.map((resource, index) => (
                    <li key={resource.id}>
                      <ResourceMiniRow resource={resource} rank={index + 1} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : tab === "new" ? (
            <>
              <SectionHeading title={dict.trendingPage.newTitle} description={dict.trendingPage.newDescription} />
              {!newest || newest.items.length === 0 ? (
                <EmptyState className="mt-4" icon="sparkles" title={dict.trendingPage.nothingNew} description={dict.trendingPage.fillGap} />
              ) : (
                <ul className="mt-4 space-y-1 rounded-card border border-hairline bg-surface p-2">
                  {newest.items.map((resource, index) => (
                    <li key={resource.id}>
                      <ResourceMiniRow resource={resource} rank={index + 1} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <SectionHeading title={dict.trendingPage.topicsTitle} description={formatMessage(dict.trendingPage.topicsDescription, { label })} />
              {topics.length === 0 ? (
                <EmptyState className="mt-4" icon="trending-up" title={dict.trendingPage.noSignal} description={dict.trendingPage.noSignalBody} />
              ) : (
                <ol className="mt-4 divide-y divide-slate-100 rounded-card border border-hairline bg-surface">
                  {topics.map((topic, index) => (
                    <li key={topic.slug} className="flex items-center gap-4 px-4 py-3">
                      <span className="w-4 shrink-0 text-[12px] font-semibold text-slate-300 tabular-nums">{index + 1}</span>
                      <Icon name={topic.icon} className={cn("size-4 shrink-0", accent(topic.accent).text)} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/topics/${topic.slug}`} className="block truncate text-[14px] font-medium text-ink hover:text-brand-700">
                          {topic.name}
                        </Link>
                        <p className="truncate text-[11px] text-muted">
                          {formatMessage(dict.trendingPage.views, { count: compactNumber(topic.views) })} · {topic.resourceCount}{" "}
                          {pluralNoun(dict, topic.resourceCount, "resource")}
                        </p>
                      </div>
                      <Sparkline values={topic.spark} className="hidden sm:block" />
                      <GrowthBadge value={topic.growth} className="w-12 shrink-0 text-right" />
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </section>

        <section>
          <SectionHeading title={dict.trendingPage.gainingTitle} description={formatMessage(dict.trendingPage.gainingDescription, { label })} />
          {resources.length === 0 ? (
            <EmptyState className="mt-4" icon="flame" title={dict.trendingPage.nothingTrending} />
          ) : (
            <ul className="mt-4 space-y-1 rounded-card border border-hairline bg-surface p-2">
              {resources.map((resource, index) => (
                <li key={resource.id} className="relative">
                  <ResourceMiniRow resource={resource} rank={index + 1} />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                    <GrowthBadge value={resource.growth} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-10">
        <SectionHeading
          title={dict.trendingPage.heatmapTitle}
          description={dict.trendingPage.heatmapDescription}
        />
        <Panel className="mt-4 p-5">
          {heatmap.cells.length === 0 ? (
            <EmptyState icon="activity" title={dict.trendingPage.noHeatmap} />
          ) : (
            <AttentionHeatmap topics={heatmap.topics} days={heatmap.days} cells={heatmap.cells} />
          )}
        </Panel>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <SectionHeading
            title={dict.trendingPage.gapsTitle}
            description={dict.trendingPage.gapsDescription}
          />
          {gaps.length === 0 ? (
            <EmptyState className="mt-4" icon="search" title={dict.trendingPage.noGaps} description={dict.trendingPage.noGapsBody} />
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 rounded-card border border-hairline bg-surface">
              {gaps.map((gap) => (
                <li key={gap.query} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/search?q=${encodeURIComponent(gap.query)}`}
                      className="block truncate text-[14px] font-medium text-ink hover:text-brand-700"
                    >
                      &ldquo;{gap.query}&rdquo;
                    </Link>
                    <p className="text-[11px] text-muted tabular-nums">
                      {gap.searches} {pluralNoun(dict, gap.searches, "searchNoun")} · {gap.results} {pluralNoun(dict, gap.results, "result")}
                    </p>
                  </div>
                  <ButtonLink href={`/submit?url=${encodeURIComponent(gap.query)}`} variant="subtle" size="sm">
                    {dict.trendingPage.fillThisGap}
                  </ButtonLink>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="space-y-5">
          <Callout tone="brand" icon="gauge" title={dict.trendingPage.howTitle}>
            {dict.trendingPage.howBody}
          </Callout>
          <Panel className="p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{dict.trendingPage.goDeeper}</h2>
            <div className="mt-3 space-y-2">
              <ButtonLink href="/explore" variant="outline" size="sm" className="w-full justify-center">
                {dict.trendingPage.exploreTopics}
              </ButtonLink>
              <ButtonLink href="/resources?sort=trending" variant="outline" size="sm" className="w-full justify-center">
                {dict.trendingPage.browseTrending}
              </ButtonLink>
              <ButtonLink href="/submit" variant="primary" size="sm" className="w-full justify-center">
                {dict.trendingPage.submitNew}
              </ButtonLink>
            </div>
          </Panel>
        </aside>
      </section>
    </div>
  );
}
