import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { logSearch } from "@/lib/analytics/track";
import { getCurrentUserId } from "@/lib/auth/session";
import { ResourceRow } from "@/components/resource/resource-card";
import { SearchBox } from "@/components/search/search-box";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Pagination } from "@/components/ui/pagination";
import { Callout, Card, EmptyState, IconTile, Panel } from "@/components/ui/primitives";
import { getResourceTypes } from "@/lib/queries/resources";
import { getTrendingTopics } from "@/lib/queries/trending";
import { search, type SearchMode } from "@/lib/search/hybrid";
import { accent } from "@/lib/accents";
import { getDictionary } from "@/lib/i18n";
import { pluralMessage, type Dictionary } from "@/lib/i18n/dictionary";
import { cn, compactNumber } from "@/lib/utils";

const PER_PAGE = 12;

const MODES: Array<{ value: SearchMode; label: string; hint: string }> = [
  { value: "hybrid", label: "Hybrid", hint: "Keyword and meaning, fused by rank" },
  { value: "keyword", label: "Keyword", hint: "Postgres full-text ranking only" },
  { value: "semantic", label: "Semantic", hint: "Vector similarity only" },
];

export const metadata: Metadata = {
  title: "Search",
  description: "Search the atlas across papers, courses, repositories, tutorials and tools.",
  robots: { index: false },
};

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function many(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : value.split(",")).map((v) => v.trim()).filter(Boolean);
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const q = (first(params.q) ?? "").slice(0, 200);
  const modeParam = first(params.mode);
  const mode: SearchMode = modeParam === "keyword" || modeParam === "semantic" ? modeParam : "hybrid";
  const page = Math.max(1, Number(first(params.page)) || 1);
  const types = many(params.type);
  const difficulties = many(params.difficulty).filter((d) => ["beginner", "intermediate", "advanced"].includes(d));
  const topic = first(params.topic);

  const userId = await getCurrentUserId();
  const dict = await getDictionary();
  const trimmed = q.trim();

  if (!trimmed) {
    return <EmptySearch dict={dict} />;
  }

  const [response, resourceTypes] = await Promise.all([
    search(trimmed, { mode, limit: PER_PAGE, offset: (page - 1) * PER_PAGE, filters: { types, difficulties, topic }, userId }),
    getResourceTypes(),
  ]);

  // Logging the query is what powers the demand signals on /trending and in the
  // admin console, so it must not delay the response.
  after(async () => {
    await logSearch({ query: trimmed, userId, resultsCount: response.total, mode, durationMs: response.durationMs });
  });

  const totalPages = Math.max(1, Math.ceil(response.total / PER_PAGE));
  const base = { q, mode: mode === "hybrid" ? "" : mode, type: types, difficulty: difficulties, topic: topic ?? "" };
  const pagerParams: Record<string, string | string[]> = { q };
  if (mode !== "hybrid") pagerParams.mode = mode;
  if (types.length) pagerParams.type = types;
  if (difficulties.length) pagerParams.difficulty = difficulties;
  if (topic) pagerParams.topic = topic;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <SearchBox defaultValue={q} size="lg" autoFocus={false} />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {pluralMessage(dict.search.resultsFor, dict.search.resultsFor_plural, response.total, {
            count: compactNumber(response.total),
            q: trimmed,
          })}
          <span className="ml-2 text-[12px] text-muted/80 tabular-nums">{response.durationMs}ms</span>
        </p>

        <div className="flex items-center gap-1 rounded-full border border-hairline bg-surface p-1">
          {MODES.map((option) => {
            const active = option.value === mode;
            return (
              <Link
                key={option.value}
                href={buildHref({ ...base, mode: option.value === "hybrid" ? "" : option.value, page: "" })}
                title={option.value === "hybrid" ? dict.search.hybridHint : option.value === "keyword" ? dict.search.keywordHint : dict.search.semanticHint}
                className={cn(
                  "rounded-full px-3 py-1 text-[12px] font-medium transition",
                  active ? "bg-brand-600 text-white" : "text-muted hover:text-ink",
                )}
              >
                {option.value === "hybrid" ? dict.search.hybrid : option.value === "keyword" ? dict.search.keyword : dict.search.semantic}
              </Link>
            );
          })}
        </div>
      </div>

      {response.topicMatches.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-medium text-muted">{dict.search.matchingTopics}</span>
          {response.topicMatches.map((match) => (
            <Link
              key={match.slug}
              href={`/topics/${match.slug}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-2.5 py-1 text-[12px] font-medium text-ink transition hover:shadow-card",
              )}
            >
              <Icon name={match.icon} className={cn("h-3.5 w-3.5", accent(match.accent).text)} />
              {match.name}
              <span className="text-muted tabular-nums">{match.resourceCount}</span>
            </Link>
          ))}
        </div>
      )}

      {(types.length > 0 || difficulties.length > 0 || topic) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-medium text-muted">Filters</span>
          {types.map((type) => (
            <FilterPill key={type} label={type} href={buildHref({ ...base, type: types.filter((t) => t !== type), page: "" })} />
          ))}
          {difficulties.map((level) => (
            <FilterPill
              key={level}
              label={level}
              href={buildHref({ ...base, difficulty: difficulties.filter((d) => d !== level), page: "" })}
            />
          ))}
          {topic && <FilterPill label={topic} href={buildHref({ ...base, topic: "", page: "" })} />}
        </div>
      )}

      {response.didYouMean && (
        <Callout tone="brand" icon="sparkles" className="mt-5">
          {dict.search.didYouMean}{" "}
          <Link href={buildHref({ ...base, q: response.didYouMean, page: "" })} className="font-semibold text-brand-700 underline">
            {response.didYouMean}
          </Link>
          ?
        </Callout>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_260px]">
        <div>
          {response.hits.length === 0 ? (
            <EmptyState
              icon="search"
              title={dict.search.emptyTitle}
              description={dict.search.emptyBody}
              action={
            <ButtonLink href={`/submit?url=${encodeURIComponent(trimmed)}`} variant="primary" size="sm">
              {dict.common.submit}
                </ButtonLink>
              }
            />
          ) : (
            <ul className="space-y-3">
              {response.hits.map((hit) => (
                <li key={hit.id}>
                  <ResourceRow resource={hit} />
                  <ScoreTrace hit={hit} mode={mode} />
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 && (
            <div className="mt-8">
              <Pagination page={page} pageCount={totalPages} params={pagerParams} />
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <Panel className="p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{dict.search.narrowByType}</h2>
            <ul className="mt-3 space-y-1">
              {resourceTypes.slice(0, 10).map((type) => {
                const active = types.includes(type.slug);
                return (
                  <li key={type.slug}>
                    <Link
                      href={buildHref({
                        ...base,
                        type: active ? types.filter((t) => t !== type.slug) : [...types, type.slug],
                        page: "",
                      })}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-2 py-1.5 text-[13px] transition",
                        active ? "bg-brand-50 font-medium text-brand-700" : "text-muted hover:bg-hover hover:text-ink",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Icon name={type.icon} className={cn("h-3.5 w-3.5", accent(type.accent).text)} />
                        {dict.typesPlural[type.slug as keyof typeof dict.typesPlural] ?? type.pluralName}
                      </span>
                      <span className="tabular-nums text-muted">{type.count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel className="p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{dict.filters.difficulty}</h2>
            <ul className="mt-3 space-y-1">
              {["beginner", "intermediate", "advanced"].map((level) => {
                const active = difficulties.includes(level);
                return (
                  <li key={level}>
                    <Link
                      href={buildHref({
                        ...base,
                        difficulty: active ? difficulties.filter((d) => d !== level) : [...difficulties, level],
                        page: "",
                      })}
                      className={cn(
                        "block rounded-lg px-2 py-1.5 text-[13px] capitalize transition",
                        active ? "bg-brand-50 font-medium text-brand-700" : "text-muted hover:bg-hover hover:text-ink",
                      )}
                    >
                      {dict.difficulty[level as keyof typeof dict.difficulty] ?? level}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel className="p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">How this works</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              Hybrid search runs a Postgres full-text query and a pgvector similarity query in parallel, fuses the two
              rankings with reciprocal rank fusion, then re-orders the shortlist by quality, popularity, freshness and
              editorial signals.
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function FilterPill({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[12px] font-medium capitalize text-brand-700 transition hover:bg-brand-100"
    >
      {label.replace(/-/g, " ")}
      <Icon name="x" className="h-3 w-3" />
    </Link>
  );
}

/** Makes the ranking legible — the point of showing the modes at all. */
function ScoreTrace({
  hit,
  mode,
}: {
  hit: { keywordScore: number; semanticScore: number; finalScore: number; highlight: string | null };
  mode: SearchMode;
}) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-3 pl-1 text-[11px] text-muted/80 tabular-nums">
      {mode !== "semantic" && <span>keyword {hit.keywordScore.toFixed(3)}</span>}
      {mode !== "keyword" && <span>semantic {hit.semanticScore.toFixed(3)}</span>}
      <span>fused {hit.finalScore.toFixed(3)}</span>
    </div>
  );
}

async function EmptySearch({ dict }: { dict: Dictionary }) {
  const [types, topics] = await Promise.all([getResourceTypes(), getTrendingTopics(7, 6)]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <IconTile icon="search" accent="indigo" size="lg" className="mx-auto" />
        <h1 className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-ink">{dict.search.landingTitle}</h1>
        <p className="mt-2 text-sm text-muted">{dict.search.landingBody}</p>
      </div>

      <div className="mt-6">
        <SearchBox size="lg" autoFocus />
      </div>

      <Card className="mt-8 p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{dict.search.tryThese}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {["retrieval augmented generation", "agent memory", "fine-tuning on a budget", "evaluating LLM outputs", "transformer from scratch", "prompt injection"].map(
            (example) => (
              <Link
                key={example}
                href={`/search?q=${encodeURIComponent(example)}`}
                className="rounded-full border border-hairline bg-surface px-3 py-1.5 text-[13px] text-ink transition hover:border-brand-200 hover:text-brand-700"
              >
                {example}
              </Link>
            ),
          )}
        </div>

        {topics.length > 0 && (
          <>
            <h2 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{dict.search.trendingTopics}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {topics.map((topic) => (
                <Link
                  key={topic.slug}
                  href={`/topics/${topic.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1.5 text-[13px] text-ink transition hover:shadow-card"
                >
                  <Icon name={topic.icon} className={cn("h-3.5 w-3.5", accent(topic.accent).text)} />
                  {topic.name}
                </Link>
              ))}
            </div>
          </>
        )}

        <div className="mt-6 flex flex-wrap gap-2 border-t border-hairline pt-4">
          {types.slice(0, 8).map((type) => (
            <ButtonLink key={type.slug} href={`/resources?type=${type.slug}`} variant="subtle" size="sm">
              {type.pluralName}
            </ButtonLink>
          ))}
        </div>
      </Card>
    </div>
  );
}

function buildHref(params: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value || (Array.isArray(value) && value.length === 0)) continue;
    if (Array.isArray(value)) value.forEach((item) => search.append(key, item));
    else search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `/search?${qs}` : "/search";
}
