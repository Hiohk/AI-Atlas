import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FacetSidebar } from "@/components/resource/facet-sidebar";
import { ResourceBrowser } from "@/components/resource/resource-browser";
import { PathCard } from "@/components/path/path-card";
import { Icon } from "@/components/ui/icon";
import { IconTile, SectionHeading, Stat, TopicChip } from "@/components/ui/primitives";
import { getCurrentUserId } from "@/lib/auth/session";
import { track } from "@/lib/analytics/track";
import { accent } from "@/lib/accents";
import { isEmbeddedDatabase } from "@/lib/db/client";
import { getDictionary } from "@/lib/i18n";
import { facetLabel, formatMessage } from "@/lib/i18n/dictionary";
import { listPaths } from "@/lib/queries/paths";
import { countActiveFilters, filtersToQuery, parseResourceFilters, type RawSearchParams } from "@/lib/queries/filters";
import { getResourceFacets, listResources } from "@/lib/queries/resources";
import { getTopicBreadcrumb, getTopicBySlug, getTopicSlugs } from "@/lib/queries/topics";
import { cn, compactNumber } from "@/lib/utils";

export async function generateStaticParams() {
  // PGlite is exclusive to one process; Next runs this in a worker.
  if (isEmbeddedDatabase()) return [];
  const slugs = await getTopicSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const topic = await getTopicBySlug((await params).slug);
  if (!topic) return { title: "Topic not found" };

  const title = topic.shortName ? `${topic.name} (${topic.shortName})` : topic.name;
  return {
    title,
    description: topic.tagline ?? topic.description ?? undefined,
    alternates: { canonical: `/topics/${topic.slug}` },
    openGraph: { title, description: topic.tagline ?? undefined, type: "website" },
  };
}

export default async function TopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { slug } = await params;
  const rawParams = await searchParams;
  const topic = await getTopicBySlug(slug);
  if (!topic) notFound();

  const filters = parseResourceFilters(rawParams, { topic: slug });
  const userId = await getCurrentUserId();

  const [results, facets, breadcrumb, paths, dict] = await Promise.all([
    listResources(filters, userId),
    getResourceFacets(filters),
    getTopicBreadcrumb(slug),
    listPaths({}, userId),
    getDictionary(),
  ]);

  // Fire-and-forget: topic attention feeds the trending heatmap.
  void track("topic_view", { userId, topicId: topic.id });

  const tone = accent(topic.accent);
  const activeType = Array.isArray(rawParams.type) ? rawParams.type[0] : rawParams.type;
  const relevantPaths = paths.slice(0, 3);

  return (
    <>
      <section className={cn("relative overflow-hidden border-b border-hairline bg-surface")}>
        <div className={cn("absolute inset-0 bg-gradient-to-br to-transparent opacity-70", tone.glow)} aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 pt-6 pb-7 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-1.5 text-xs text-muted" aria-label="Breadcrumb">
            <Link href="/explore" className="hover:text-brand-600">
              {dict.nav.explore}
            </Link>
            {breadcrumb.map((crumb, index) => (
              <span key={crumb.slug} className="flex items-center gap-1.5">
                <Icon name="chevron-right" className="size-3 text-slate-300" />
                {index === breadcrumb.length - 1 ? (
                  <span className="font-medium text-ink">{crumb.name}</span>
                ) : (
                  <Link href={`/topics/${crumb.slug}`} className="hover:text-brand-600">
                    {crumb.name}
                  </Link>
                )}
              </span>
            ))}
          </nav>

          <div className="mt-5 flex flex-wrap items-start gap-5">
            <IconTile icon={topic.icon} accent={topic.accent} size="lg" className="shadow-card" />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-3xl">
                {topic.name}
                {topic.shortName ? <span className="text-muted"> ({topic.shortName})</span> : null}
              </h1>
              {topic.tagline ? <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{topic.tagline}</p> : null}

              <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
                <Stat icon="layers" label={dict.common.resources} value={compactNumber(topic.resourceCount)} />
                <Stat icon="route" label={dict.nav.paths} value={compactNumber(topic.pathCount)} />
                <Stat icon="users" label={dict.common.contributors} value={compactNumber(topic.contributorCount)} />
                <Stat icon="graduation-cap" label={dict.common.learners} value={compactNumber(topic.learnerCount)} />
              </div>
            </div>
          </div>

          {topic.related.length > 0 ? (
            <div className="mt-6 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">{dict.common.related}</span>
              {topic.related.map((related) => (
                <TopicChip key={related.slug} slug={related.slug} name={related.name} size="md" />
              ))}
            </div>
          ) : null}
        </div>

        <div className="relative mx-auto max-w-7xl overflow-x-auto px-4 scrollbar-none sm:px-6 lg:px-8">
          <div className="flex gap-1 border-t border-hairline pt-2 pb-2">
            <TypeTab href={`/topics/${slug}`} label={dict.filters.all} active={!activeType} />
            {facets.types.slice(0, 9).map((type) => (
              <TypeTab
                key={type.value}
                href={`/topics/${slug}?type=${type.value}`}
                label={facetLabel(dict, "type", type.value, type.label)}
                count={type.count}
                active={activeType === type.value}
              />
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {topic.description ? (
          <p className="mb-8 max-w-3xl text-[15px] leading-relaxed text-muted">{topic.description}</p>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[13rem_1fr]">
          <div className="lg:sticky lg:top-20 lg:self-start">
            <FacetSidebar
              facets={facets}
              subtopics={topic.children}
              subtopicBasePath={`/topics/${slug}`}
              activeFilterCount={countActiveFilters({ ...filters, topic: undefined })}
              keepOnClear={["sort", "view"]}
            />
          </div>

          <div className="space-y-12">
            <ResourceBrowser
              results={results}
              facets={facets}
              params={filtersToQuery(rawParams)}
              view={filters.view}
              searchPlaceholder={formatMessage(dict.topicPage.searchPlaceholder, { name: topic.shortName ?? topic.name })}
            />

            {relevantPaths.length > 0 ? (
              <section>
                <SectionHeading
                  eyebrow={dict.pathsPage.eyebrow}
                  eyebrowIcon="route"
                  title={formatMessage(dict.topicPage.structuredRoutes, { name: topic.shortName ?? topic.name })}
                  description={dict.topicPage.structuredRoutesBody}
                />
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {relevantPaths.map((path) => (
                    <PathCard key={path.slug} path={path} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

function TypeTab({ href, label, count, active }: { href: string; label: string; count?: number; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors",
        active ? "bg-brand-600 text-white" : "text-muted hover:bg-hover hover:text-ink",
      )}
    >
      {label}
      {count != null && !active ? <span className="ml-1 text-[11px] text-slate-400">{count}</span> : null}
    </Link>
  );
}
