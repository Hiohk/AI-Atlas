"use client";

import { FacetCheckbox, ClearFiltersButton, QuickFilterToggle } from "@/components/resource/filter-controls";
import { SubtopicLink } from "@/components/topic/topic-card";
import { useDictionary } from "@/components/providers/preferences-provider";
import { QUICK_FILTERS } from "@/lib/config";
import { facetLabel, pluralMessage } from "@/lib/i18n/dictionary";
import type { ResourceFacets } from "@/lib/queries/types";
import type { TopicSummary } from "@/lib/queries/topics";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 px-2 text-[11px] font-semibold tracking-[0.1em] text-ink uppercase">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

const QUICK_LABELS = {
  free: "free",
  code: "code",
  fresh: "fresh",
  official: "official",
} as const;

export function FacetSidebar({
  facets,
  subtopics,
  subtopicBasePath,
  activeSubtopic,
  showQuickFilters = true,
  showTypes = true,
  showDifficulties = true,
  showLanguages = true,
  activeFilterCount = 0,
  keepOnClear = [],
}: {
  facets: ResourceFacets;
  subtopics?: TopicSummary[];
  subtopicBasePath?: string;
  activeSubtopic?: string;
  showQuickFilters?: boolean;
  showTypes?: boolean;
  showDifficulties?: boolean;
  showLanguages?: boolean;
  activeFilterCount?: number;
  keepOnClear?: string[];
}) {
  const dict = useDictionary();

  return (
    <aside className="space-y-6">
      {activeFilterCount > 0 ? (
        <div className="flex items-center justify-between px-2">
          <span className="text-[12px] text-muted">
            {pluralMessage(dict.filters.filtersActive, dict.filters.filtersActive_plural, activeFilterCount)}
          </span>
          <ClearFiltersButton keep={keepOnClear} />
        </div>
      ) : null}

      {subtopics && subtopics.length > 0 && subtopicBasePath ? (
        <Group title={dict.filters.subtopics}>
          <SubtopicLink href={subtopicBasePath} name={dict.filters.allTopics} count={facets.total} active={!activeSubtopic} />
          {subtopics.map((topic) => (
            <SubtopicLink
              key={topic.slug}
              href={`/topics/${topic.slug}`}
              name={topic.shortName ?? topic.name}
              count={topic.resourceCount}
              active={activeSubtopic === topic.slug}
            />
          ))}
        </Group>
      ) : null}

      {showTypes && facets.types.length > 1 ? (
        <Group title={dict.filters.resourceType}>
          {facets.types.map((bucket) => (
            <FacetCheckbox
              key={bucket.value}
              param="type"
              value={bucket.value}
              label={facetLabel(dict, "type", bucket.value, bucket.label)}
              count={bucket.count}
            />
          ))}
        </Group>
      ) : null}

      {showDifficulties && facets.difficulties.length > 1 ? (
        <Group title={dict.filters.difficulty}>
          {facets.difficulties.map((bucket) => (
            <FacetCheckbox
              key={bucket.value}
              param="difficulty"
              value={bucket.value}
              label={facetLabel(dict, "difficulty", bucket.value, bucket.label)}
              count={bucket.count}
            />
          ))}
        </Group>
      ) : null}

      {showLanguages && facets.languages.length > 1 ? (
        <Group title={dict.filters.language}>
          {facets.languages.map((bucket) => (
            <FacetCheckbox
              key={bucket.value}
              param="lang"
              value={bucket.value}
              label={facetLabel(dict, "language", bucket.value, bucket.label)}
              count={bucket.count}
            />
          ))}
        </Group>
      ) : null}

      {showQuickFilters ? (
        <Group title={dict.filters.quickFilters}>
          {QUICK_FILTERS.map((filter) => (
            <QuickFilterToggle
              key={filter.key}
              param={filter.key}
              label={dict.filters[QUICK_LABELS[filter.key]]}
            />
          ))}
        </Group>
      ) : null}
    </aside>
  );
}
