import Link from "next/link";
import { PathCard } from "@/components/path/path-card";
import { ResourceCard } from "@/components/resource/resource-card";
import { SearchBox } from "@/components/search/search-box";
import { TopicCard } from "@/components/topic/topic-card";
import { ButtonLink } from "@/components/ui/button";
import { GrowthBadge, Sparkline } from "@/components/ui/charts";
import { Icon } from "@/components/ui/icon";
import { AvatarStack, Card, Panel, SectionHeading, Stat, ViewAllLink } from "@/components/ui/primitives";
import { getCurrentUserId, listContributors } from "@/lib/auth/session";
import { formatMessage, pluralNoun } from "@/lib/i18n/dictionary";
import { getDictionary } from "@/lib/i18n";
import { listPaths } from "@/lib/queries/paths";
import { getEditorPicks, getPlatformStats } from "@/lib/queries/resources";
import { listTopics } from "@/lib/queries/topics";
import { getTrendingTopics } from "@/lib/queries/trending";
import { compactNumber } from "@/lib/utils";

export default async function HomePage() {
  const userId = await getCurrentUserId();
  const dict = await getDictionary();
  const [topics, picks, trendingTopics, paths, stats, contributors] = await Promise.all([
    listTopics({ featuredOnly: true, limit: 6 }),
    getEditorPicks(5, userId),
    getTrendingTopics(30, 5),
    listPaths({ sort: "popular" }, userId),
    getPlatformStats(),
    listContributors(5),
  ]);

  return (
    <>
      <section className="relative overflow-hidden border-b border-hairline bg-surface bg-hero-mesh">
        <div className="absolute inset-0 bg-grid-faint opacity-40" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-14 sm:px-6 lg:px-8 lg:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-surface/80 px-3 py-1 text-xs font-medium text-brand-700">
              <Icon name="sparkles" className="size-3.5" />
              {dict.home.badge}
            </span>

            <h1 className="animate-rise mt-5 text-4xl leading-[1.08] font-semibold tracking-[-0.03em] text-balance-tight text-ink sm:text-5xl lg:text-[3.4rem]">
              {dict.home.headlineBefore}{" "}
              <span className="bg-linear-to-r from-brand-600 to-violet-500 bg-clip-text text-transparent">AI</span>.{" "}
              {dict.home.headlineAfter}
              <br className="hidden sm:block" /> {dict.home.headlineLine2}
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-muted">{dict.home.subtitle}</p>

            <div className="mx-auto mt-7 max-w-2xl">
              <SearchBox size="lg" />
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              <Stat icon="layers" label={dict.common.resources} value={`${compactNumber(stats.resources)}+`} />
              <Stat icon="users" label={dict.common.contributors} value={`${compactNumber(stats.contributors)}+`} />
              <Stat icon="graduation-cap" label={dict.common.learners} value={`${compactNumber(stats.learners)}+`} />
            </div>

            {trendingTopics.length > 0 ? (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs">
                <span className="font-semibold text-ink">{dict.home.trendingLabel}</span>
                {trendingTopics.map((topic) => (
                  <Link
                    key={topic.slug}
                    href={`/topics/${topic.slug}`}
                    className="rounded-lg border border-hairline bg-surface px-2.5 py-1 font-medium text-muted transition-colors hover:border-brand-200 hover:text-brand-700"
                  >
                    {topic.name}
                  </Link>
                ))}
                <Link href="/trending" className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700">
                  {dict.common.more}
                  <Icon name="chevron-right" className="size-3" />
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-14 px-4 py-14 sm:px-6 lg:px-8">
        {userId && paths.some((path) => path.progress != null) ? (
          <section>
            <SectionHeading
              eyebrow={dict.home.continueEyebrow}
              eyebrowIcon="play"
              title={dict.home.continueTitle}
              action={<ViewAllLink href="/me?tab=paths">{dict.home.yourLibrary}</ViewAllLink>}
            />
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {paths
                .filter((path) => path.progress != null)
                .slice(0, 3)
                .map((path) => (
                  <PathCard key={path.slug} path={path} />
                ))}
            </div>
          </section>
        ) : null}

        <section>
          <SectionHeading
            eyebrow={dict.home.exploreEyebrow}
            eyebrowIcon="compass"
            title={dict.home.exploreTitle}
            action={<ViewAllLink href="/explore">{dict.home.viewAllTopics}</ViewAllLink>}
          />
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {topics.map((topic) => (
              <TopicCard key={topic.slug} topic={topic} />
            ))}
          </div>
        </section>

        <section>
          <SectionHeading
            eyebrow={dict.home.picksEyebrow}
            eyebrowIcon="sparkles"
            title={dict.home.picksTitle}
            description={dict.home.picksDescription}
            action={<ViewAllLink href="/resources?picks=1">{dict.home.viewAllPicks}</ViewAllLink>}
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {picks.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow={dict.home.trendingEyebrow}
              eyebrowIcon="flame"
              title={dict.home.trendingTitle}
              description={dict.home.trendingDescription}
            />
            <Card className="mt-5 divide-y divide-hairline p-1.5">
              {trendingTopics.map((topic, index) => (
                <Link
                  key={topic.slug}
                  href={`/topics/${topic.slug}`}
                  className="flex items-center gap-3 rounded-lg px-2.5 py-3 transition-colors hover:bg-hover"
                >
                  <span className="w-5 shrink-0 text-xs font-semibold text-muted tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{topic.name}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {compactNumber(topic.resourceCount)} {pluralNoun(dict, topic.resourceCount, "resource")}
                    </span>
                  </span>
                  <Sparkline values={topic.spark} className="hidden shrink-0 sm:block" />
                  <GrowthBadge value={topic.growth} className="w-12 shrink-0 text-right" />
                </Link>
              ))}
              <div className="p-1.5 pt-2">
                <ButtonLink href="/trending" variant="subtle" size="sm" className="w-full justify-between">
                  {dict.home.exploreTrending}
                  <Icon name="chevron-right" className="size-3.5" />
                </ButtonLink>
              </div>
            </Card>
          </div>

          <div>
            <SectionHeading
              eyebrow={dict.home.pathsEyebrow}
              eyebrowIcon="route"
              title={dict.home.pathsTitle}
              description={dict.home.pathsDescription}
              action={<ViewAllLink href="/paths">{dict.home.viewAllPaths}</ViewAllLink>}
            />
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {paths.slice(0, 3).map((path) => (
                <PathCard key={path.slug} path={path} />
              ))}
            </div>
          </div>
        </section>

        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-6 bg-brand-50/50 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white">
                <Icon name="sparkles" className="size-6" />
              </span>
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.01em] text-brand-800">{dict.home.contributeTitle}</h2>
                <p className="mt-1 max-w-lg text-sm text-muted">{dict.home.contributeBody}</p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <ButtonLink href="/submit" size="md">
                <Icon name="plus" className="size-4" />
                {dict.home.submitCta}
              </ButtonLink>
              <div className="flex items-center gap-2">
                <AvatarStack people={contributors} max={4} extra={Math.max(0, stats.contributors - 4)} />
                <span className="text-xs text-muted">
                  {formatMessage(dict.home.joinContributors, { count: compactNumber(stats.contributors) })}
                </span>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
