"use client";

import { FilterSelect, SortSelect, ViewToggle } from "@/components/resource/filter-controls";
import { ResourceCard, ResourceRow } from "@/components/resource/resource-card";
import { SearchBox } from "@/components/search/search-box";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { Pagination } from "@/components/ui/pagination";
import { useDictionary } from "@/components/providers/preferences-provider";
import { SORT_OPTIONS } from "@/lib/config";
import { facetLabel, formatMessage, pluralMessage } from "@/lib/i18n/dictionary";
import type { Paginated, ResourceFacets, ResourceListItem } from "@/lib/queries/types";
import { compactNumber } from "@/lib/utils";

export function ResourceBrowser({
  results,
  facets,
  params,
  view,
  searchPlaceholder,
  showSearch = true,
}: {
  results: Paginated<ResourceListItem>;
  facets: ResourceFacets;
  params: Record<string, string | string[]>;
  view: "grid" | "list";
  searchPlaceholder?: string;
  showSearch?: boolean;
}) {
  const dict = useDictionary();
  const sortOptions = SORT_OPTIONS.map((option) => ({
    ...option,
    label: dict.sorts[option.value as keyof typeof dict.sorts] ?? option.label,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {showSearch ? (
          <div className="w-full min-w-56 flex-1 sm:max-w-xs">
            <SearchBox
              size="sm"
              placeholder={searchPlaceholder ?? dict.resourcesPage.searchPlaceholder}
              showButton={false}
              defaultValue={String(params.q ?? "")}
            />
          </div>
        ) : null}

        <FilterSelect
          param="difficulty"
          label={dict.filters.difficulty}
          options={facets.difficulties.map((bucket) => ({
            ...bucket,
            label: facetLabel(dict, "difficulty", bucket.value, bucket.label),
          }))}
        />
        <FilterSelect
          param="type"
          label={dict.filters.type}
          options={facets.types.map((bucket) => ({
            ...bucket,
            label: facetLabel(dict, "type", bucket.value, bucket.label),
          }))}
        />
        <FilterSelect
          param="lang"
          label={dict.filters.language}
          options={facets.languages.map((bucket) => ({
            ...bucket,
            label: facetLabel(dict, "language", bucket.value, bucket.label),
          }))}
        />

        <div className="ml-auto flex items-center gap-2">
          <SortSelect options={sortOptions} />
          <ViewToggle />
        </div>
      </div>

      <p className="text-[13px] font-medium text-ink">
        {pluralMessage(dict.resourcesPage.count, dict.resourcesPage.count_plural, results.total, {
          count: compactNumber(results.total),
        })}
        {results.pageCount > 1 ? (
          <span className="font-normal text-muted">
            {" "}
            · {formatMessage(dict.common.pageOf, { page: results.page, pageCount: results.pageCount })}
          </span>
        ) : null}
      </p>

      {results.items.length === 0 ? (
        <EmptyState
          icon="search"
          title={dict.resourcesPage.emptyTitle}
          description={dict.resourcesPage.emptyBody}
          action={
            <ButtonLink href="/submit" variant="outline" size="sm">
              {dict.common.submit}
            </ButtonLink>
          }
        />
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {results.items.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {results.items.map((resource) => (
            <ResourceRow key={resource.id} resource={resource} />
          ))}
        </div>
      )}

      <Pagination page={results.page} pageCount={results.pageCount} params={params} />
    </div>
  );
}
