import type { Metadata } from "next";
import { FacetSidebar } from "@/components/resource/facet-sidebar";
import { ResourceBrowser } from "@/components/resource/resource-browser";
import { SearchBox } from "@/components/search/search-box";
import { Panel, TopicChip } from "@/components/ui/primitives";
import { getCurrentUserId } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n";
import { countActiveFilters, filtersToQuery, parseResourceFilters, type RawSearchParams } from "@/lib/queries/filters";
import { getResourceFacets, listResources } from "@/lib/queries/resources";
import { listTopics } from "@/lib/queries/topics";

export const metadata: Metadata = {
  title: "All resources",
  description: "Browse every AI resource in the atlas — papers, courses, repos, blogs, videos, books and tools.",
};

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = await searchParams;
  const filters = parseResourceFilters(params);
  const userId = await getCurrentUserId();

  const [results, facets, topics, dict] = await Promise.all([
    listResources(filters, userId),
    getResourceFacets(filters),
    listTopics({ featuredOnly: true, limit: 10 }),
    getDictionary(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink">{dict.resourcesPage.title}</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted">{dict.resourcesPage.subtitle}</p>
        <div className="mx-auto mt-5 max-w-2xl">
          <SearchBox
            size="lg"
            action="/resources"
            defaultValue={String(params.q ?? "")}
            placeholder={dict.resourcesPage.searchPlaceholder}
          />
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)_14rem]">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <FacetSidebar
            facets={facets}
            showQuickFilters={false}
            showLanguages={false}
            activeFilterCount={countActiveFilters(filters)}
            keepOnClear={["q", "sort", "view"]}
          />
        </div>

        <ResourceBrowser
          results={results}
          facets={facets}
          params={filtersToQuery(params)}
          view={filters.view}
          showSearch={false}
          searchPlaceholder={dict.resourcesPage.searchPlaceholder}
        />

        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <FacetSidebar
            facets={facets}
            showTypes={false}
            showDifficulties={false}
            showLanguages={false}
            showQuickFilters
            activeFilterCount={0}
            keepOnClear={["q", "sort", "view"]}
          />
          <Panel className="p-4">
            <p className="mb-2.5 text-[11px] font-semibold tracking-[0.1em] text-ink uppercase">{dict.common.popularTopics}</p>
            <div className="flex flex-wrap gap-1.5">
              {topics.map((topic) => (
                <TopicChip key={topic.slug} slug={topic.slug} name={topic.shortName ?? topic.name} size="md" />
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
