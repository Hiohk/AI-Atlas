import type { Metadata } from "next";
import Link from "next/link";
import { PathCard, PathRow } from "@/components/path/path-card";
import { PathFinder } from "@/components/path/path-finder";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Eyebrow, EmptyState, Panel, TopicChip } from "@/components/ui/primitives";
import { getCurrentUserId } from "@/lib/auth/session";
import { getPathCategories, listPaths } from "@/lib/queries/paths";
import { listTopics } from "@/lib/queries/topics";
import { getDictionary } from "@/lib/i18n";
import { formatMessage, pluralNoun } from "@/lib/i18n/dictionary";
import { cn, compactNumber } from "@/lib/utils";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Learning paths",
  description:
    "Curated, ordered curricula for AI: fundamentals, LLM application engineering, RAG systems, agents, research and fine-tuning.",
};

const DIFFICULTIES = [
  { value: "all" },
  { value: "beginner" },
  { value: "intermediate" },
  { value: "advanced" },
] as const;

const SORTS = [
  { value: "popular", label: "Popular" },
  { value: "duration", label: "Shortest" },
  { value: "newest", label: "Newest" },
] as const;

export default async function PathsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; difficulty?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const category = params.category ?? "all";
  const difficulty = params.difficulty ?? "all";
  const sort = (SORTS.find((option) => option.value === params.sort)?.value ?? "popular") as "popular" | "duration" | "newest";

  const userId = await getCurrentUserId();
  const dict = await getDictionary();
  const [paths, categories, topics] = await Promise.all([
    listPaths({ category, difficulty, sort }, userId),
    getPathCategories(),
    listTopics({ featuredOnly: true, limit: 8 }),
  ]);

  const allPaths = category === "all" && difficulty === "all" ? paths : await listPaths({ sort: "popular" }, userId);
  const learners = allPaths.reduce((total, path) => total + path.learnersCount, 0);
  const enrolled = allPaths.filter((path) => path.progress !== null);
  const href = (next: { category?: string; difficulty?: string; sort?: string }) => {
    const search = new URLSearchParams();
    const merged = { category, difficulty, sort, ...next };
    if (merged.category && merged.category !== "all") search.set("category", merged.category);
    if (merged.difficulty && merged.difficulty !== "all") search.set("difficulty", merged.difficulty);
    if (merged.sort && merged.sort !== "popular") search.set("sort", merged.sort);
    const qs = search.toString();
    return qs ? `/paths?${qs}` : "/paths";
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <Eyebrow icon="route">{dict.pathsPage.eyebrow}</Eyebrow>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-ink">{dict.pathsPage.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {formatMessage(dict.pathsPage.subtitle, {
            count: compactNumber(learners),
            learners: pluralNoun(dict, learners, "learner"),
          })}
        </p>
      </div>

      {enrolled.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-ink">{dict.pathsPage.continue}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {enrolled.map((path) => (
              <PathCard key={path.id} path={path} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-2 border-b border-hairline pb-4">
        {DIFFICULTIES.map((option) => (
          <FilterLink key={option.value} href={href({ difficulty: option.value })} active={difficulty === option.value}>
            {option.value === "all" ? dict.pathsPage.allPaths : dict.difficulty[option.value as keyof typeof dict.difficulty]}
          </FilterLink>
        ))}

        <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />

        <FilterLink href={href({ category: "all" })} active={category === "all"}>
          {dict.pathsPage.allTracks}
        </FilterLink>
        {categories.map((option) => (
          <FilterLink key={option.value} href={href({ category: option.value })} active={category === option.value}>
            {option.label}
            <span className="ml-1.5 text-[11px] text-muted tabular-nums">{option.count}</span>
          </FilterLink>
        ))}

        <div className="ml-auto flex items-center gap-1">
          {SORTS.map((option) => (
            <Link
              key={option.value}
              href={href({ sort: option.value })}
              className={cn(
                "rounded-full px-2.5 py-1 text-[12px] transition",
                sort === option.value ? "bg-slate-900 text-white" : "text-muted hover:text-ink",
              )}
            >
              {option.value === "popular"
                ? dict.common.popular
                : option.value === "duration"
                  ? dict.pathsPage.shortest
                  : dict.pathsPage.newest}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          {paths.length === 0 ? (
            <EmptyState icon="route" title={dict.pathsPage.emptyTitle} description={dict.pathsPage.emptyBody} />
          ) : (
            paths.map((path) => <PathRow key={path.id} path={path} />)
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div id="path-finder">
            <PathFinder paths={allPaths} />
          </div>

          <Panel className="p-5">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-ink uppercase">{dict.common.popularTopics}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {topics.map((topic) => (
                <TopicChip key={topic.slug} slug={topic.slug} name={topic.shortName ?? topic.name} size="md" />
              ))}
            </div>
          </Panel>
        </aside>
      </div>

      {!userId ? (
        <Panel className="mt-10 overflow-hidden bg-brand-50/50 p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.01em] text-brand-800">{dict.pathsPage.signInTitle}</h2>
              <p className="mt-1 max-w-xl text-sm text-muted">{dict.pathsPage.signInBody}</p>
            </div>
            <ButtonLink href="/login?redirectTo=/paths" size="md">
              {dict.nav.signIn}
            </ButtonLink>
          </div>
        </Panel>
      ) : (
        <Panel className="mt-10 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink">{dict.pathsPage.howTitle}</h2>
              <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted">{dict.pathsPage.howBody}</p>
            </div>
            <Link
              href="/explore"
              className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-brand-700 hover:text-brand-800"
            >
              {dict.pathsPage.browseTopics}
              <Icon name="arrow-right" className="size-3.5" />
            </Link>
          </div>
        </Panel>
      )}
    </div>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] font-medium transition",
        active ? "border-brand-200 bg-brand-50 text-brand-700" : "border-hairline bg-surface text-muted hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}
