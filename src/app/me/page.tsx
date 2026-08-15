import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { getLibrarySummary } from "@/app/actions/library";
import { PathRow } from "@/components/path/path-card";
import { ResourceMiniRow, ResourceRow } from "@/components/resource/resource-card";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Avatar, Card, Chip, EmptyState, Eyebrow, Panel, Progress, Stat } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth/session";
import { query, queryOne } from "@/lib/db/query";
import { getDictionary, getLocale } from "@/lib/i18n";
import { formatMessage, pluralNoun, type Dictionary, type Locale } from "@/lib/i18n/dictionary";
import { listPaths, type PathSummary } from "@/lib/queries/paths";
import { listMySubmissions, type MySubmission } from "@/lib/queries/submissions";
import type { ResourceListItem } from "@/lib/queries/types";
import { cn, compactNumber, formatDate, relativeTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Your library",
  description: "Everything you saved, started and finished on AI Atlas, in one place.",
};

const TABS = [
  { value: "saved", label: "Saved", icon: "bookmark" },
  { value: "progress", label: "In progress", icon: "circle-dashed" },
  { value: "completed", label: "Completed", icon: "check-circle" },
  { value: "paths", label: "Paths", icon: "route" },
  { value: "submissions", label: "Submissions", icon: "plus" },
] as const;

type TabValue = (typeof TABS)[number]["value"];
type LibraryItem = ResourceListItem & { updatedAt: string };

/**
 * There is no shared query for a user's bookmark lists yet, so the projection
 * lives here; it mirrors the card columns in `lib/queries/resources.ts`.
 */
async function listBookmarked(userId: string, state: "saved" | "in_progress" | "completed", limit = 40) {
  return query<LibraryItem>(sql`
    SELECT r.id, r.slug, r.title, r.url, r.description, r.difficulty, r.language,
      r.price_model AS "priceModel", r.estimated_minutes AS "estimatedMinutes",
      r.author_name AS "authorName", r.organization_name AS "organizationName",
      r.thumbnail_url AS "thumbnailUrl", r.is_official AS "isOfficial", r.has_code AS "hasCode",
      r.is_editor_pick AS "isEditorPick", ep.note AS "editorNote",
      r.quality_score::float AS "qualityScore", r.community_score::float AS "communityScore",
      r.ratings_count AS "ratingsCount", r.trending_score::float AS "trendingScore",
      r.views_count AS "viewsCount", r.saves_count AS "savesCount",
      r.published_at AS "publishedAt", r.source_updated_at AS "sourceUpdatedAt", r.metadata,
      rt.slug AS "typeSlug", rt.name AS "typeName", rt.accent AS "typeAccent", rt.icon AS "typeIcon",
      COALESCE((
        SELECT json_agg(json_build_object('slug', t.slug, 'name', COALESCE(t.short_name, t.name), 'isPrimary', xt.is_primary)
                        ORDER BY xt.is_primary DESC, xt.relevance DESC)
        FROM resource_topics xt JOIN topics t ON t.id = xt.topic_id WHERE xt.resource_id = r.id
      ), '[]'::json) AS topics,
      b.state AS "bookmarkState", b.updated_at AS "updatedAt"
    FROM bookmarks b
    JOIN resources r ON r.id = b.resource_id
    JOIN resource_types rt ON rt.id = r.resource_type_id
    LEFT JOIN editorial_picks ep ON ep.resource_id = r.id
    WHERE b.user_id = ${userId} AND b.state = ${state}::learning_state
    ORDER BY b.updated_at DESC
    LIMIT ${limit}
  `);
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirectTo=/me");
  const dict = await getDictionary();
  const locale = await getLocale();

  const params = await searchParams;
  const requested = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab: TabValue = TABS.some((option) => option.value === requested) ? (requested as TabValue) : "saved";

  const [summary, saved, inProgress, completed, paths, profile, submissions] = await Promise.all([
    getLibrarySummary(),
    listBookmarked(user.id, "saved"),
    listBookmarked(user.id, "in_progress"),
    listBookmarked(user.id, "completed"),
    listPaths({ sort: "popular" }, user.id),
    queryOne<{ createdAt: string }>(sql`SELECT created_at AS "createdAt" FROM profiles WHERE id = ${user.id}`),
    listMySubmissions(user.id, 40),
  ]);

  const enrolled = paths.filter((path) => path.progress != null);
  const suggestions = paths.filter((path) => path.progress == null).slice(0, 3);
  const continueItem = inProgress[0] ?? saved[0] ?? null;

  const counts: Record<TabValue, number> = {
    saved: summary?.saved ?? saved.length,
    progress: summary?.inProgress ?? inProgress.length,
    completed: summary?.completed ?? completed.length,
    paths: enrolled.length,
    submissions: summary?.submissions ?? submissions.length,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Card className="overflow-hidden bg-hero-mesh p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="flex items-start gap-4">
            <Avatar src={user.avatarUrl} name={user.displayName} size={56} />
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">{user.displayName}</h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
                <span>@{user.username}</span>
                <Chip className="bg-brand-50 text-brand-700 ring-brand-100 capitalize">{user.role}</Chip>
                {user.isTrusted ? (
                  <Chip className="bg-emerald-50 text-emerald-700 ring-emerald-100">
                    <Icon name="shield-check" className="size-2.5" />
                    {dict.me.trusted}
                  </Chip>
                ) : null}
                {profile?.createdAt ? (
                  <span className="text-slate-400">
                    {formatMessage(dict.me.memberSince, { date: formatDate(profile.createdAt, locale) ?? "" })}
                  </span>
                ) : null}
              </p>
              {user.headline ? <p className="mt-1.5 max-w-lg text-[13px] text-muted">{user.headline}</p> : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Stat icon="bookmark" label={dict.me.saved} value={<span className="tabular-nums">{counts.saved}</span>} />
            <Stat icon="circle-dashed" label={dict.me.progress} value={<span className="tabular-nums">{counts.progress}</span>} />
            <Stat icon="check-circle" label={dict.me.completed} value={<span className="tabular-nums">{counts.completed}</span>} />
            <Stat icon="route" label={dict.me.paths} value={<span className="tabular-nums">{counts.paths}</span>} />
          </div>
        </div>
      </Card>

      <nav aria-label="Library sections" className="mt-6 flex flex-wrap items-center gap-1.5">
        {TABS.map((option) => {
          const active = option.value === tab;
          return (
            <Link
              key={option.value}
              href={`/me?tab=${option.value}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                active
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-hairline bg-surface text-muted hover:border-brand-200 hover:text-ink",
              )}
            >
              <Icon name={option.icon} className="size-3.5" />
              {option.value === "saved"
                ? dict.me.saved
                : option.value === "progress"
                  ? dict.me.progress
                  : option.value === "completed"
                    ? dict.me.completed
                    : option.value === "paths"
                      ? dict.me.paths
                      : dict.me.submissions}
              <span className={cn("tabular-nums", active ? "text-white/70" : "text-slate-400")}>
                {counts[option.value]}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-3">
          {tab === "saved" ? <LibraryList items={saved} empty="saved" dict={dict} /> : null}
          {tab === "progress" ? <LibraryList items={inProgress} empty="progress" dict={dict} /> : null}
          {tab === "completed" ? <LibraryList items={completed} empty="completed" dict={dict} /> : null}
          {tab === "paths" ? (
            enrolled.length === 0 ? (
              <EmptyState
                icon="route"
                title={dict.me.emptyPathsTitle}
                description={dict.me.emptyPathsBody}
                action={
                  <ButtonLink href="/paths" size="sm">
                    {dict.me.browsePaths}
                  </ButtonLink>
                }
              />
            ) : (
              enrolled.map((path) => <PathRow key={path.slug} path={path} />)
            )
          ) : null}
          {tab === "submissions" ? <SubmissionList items={submissions} dict={dict} locale={locale} /> : null}
        </div>

        <aside className="space-y-4">
          <Panel className="p-4">
            <Eyebrow icon="play">{dict.me.continue}</Eyebrow>
            {continueItem ? (
              <div className="mt-3">
                <ResourceMiniRow resource={continueItem} />
                <p className="mt-1 px-2.5 text-[11px] text-muted">
                  {formatMessage(dict.me.lastTouched, { time: relativeTime(continueItem.updatedAt, locale) ?? "" })}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-muted">
                {dict.me.nothingProgress}{" "}
                <Link href="/explore" className="font-medium text-brand-600 hover:text-brand-700">
                  {dict.me.findSomething}
                </Link>
              </p>
            )}
          </Panel>

          <Panel className="p-4">
            <Eyebrow icon="sparkles">{dict.me.recommended}</Eyebrow>
            <p className="mt-1.5 text-[11px] text-muted">{dict.me.recommendedHint}</p>
            {suggestions.length > 0 ? (
              <ul className="mt-3 space-y-2.5">
                {suggestions.map((path) => (
                  <PathSuggestion key={path.slug} path={path} dict={dict} />
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[13px] text-muted">{dict.me.onEveryPath}</p>
            )}
            <ButtonLink href="/explore" variant="subtle" size="sm" className="mt-3 w-full justify-between">
              {dict.me.exploreAtlas}
              <Icon name="chevron-right" className="size-3.5" />
            </ButtonLink>
          </Panel>

          {enrolled.length > 0 ? (
            <Panel className="p-4">
              <Eyebrow icon="route">{dict.me.pathProgress}</Eyebrow>
              <ul className="mt-3 space-y-3">
                {enrolled.slice(0, 4).map((path) => (
                  <li key={path.slug}>
                    <Link href={`/paths/${path.slug}`} className="block text-[13px] font-medium text-ink hover:text-brand-700">
                      {path.title}
                    </Link>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Progress value={path.progress ?? 0} className="flex-1" />
                      <span className="text-[11px] font-semibold text-brand-600 tabular-nums">{path.progress ?? 0}%</span>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel className="p-4">
            <Eyebrow icon="plus">{dict.me.contribute}</Eyebrow>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              {formatMessage(dict.me.submittedCount, {
                count: compactNumber(summary?.submissions ?? 0),
                noun: pluralNoun(dict, summary?.submissions ?? 0, "resource"),
              })}
            </p>
            <ButtonLink href="/submit" size="sm" className="mt-3 w-full">
              <Icon name="plus" className="size-3.5" />
              {dict.common.submit}
            </ButtonLink>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function LibraryList({
  items,
  empty,
  dict,
}: {
  items: LibraryItem[];
  empty: Exclude<TabValue, "submissions">;
  dict: Dictionary;
}) {
  if (items.length === 0) {
    const copy = {
      saved: { title: dict.me.emptySavedTitle, description: dict.me.emptySavedBody },
      progress: { title: dict.me.emptyProgressTitle, description: dict.me.emptyProgressBody },
      completed: { title: dict.me.emptyCompletedTitle, description: dict.me.emptyCompletedBody },
      paths: { title: dict.me.emptyPathsTitle, description: dict.me.emptyPathsBody },
    }[empty];

    return (
      <EmptyState
        icon="bookmark"
        title={copy.title}
        description={copy.description}
        action={
          <ButtonLink href="/explore" size="sm">
            {dict.me.exploreAtlas}
          </ButtonLink>
        }
      />
    );
  }

  return (
    <>
      {items.map((resource) => (
        <ResourceRow key={resource.id} resource={resource} />
      ))}
    </>
  );
}

const SUBMISSION_TONE: Record<string, string> = {
  published: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  rejected: "bg-rose-50 text-rose-700 ring-rose-100",
  failed: "bg-rose-50 text-rose-700 ring-rose-100",
  ready_for_review: "bg-amber-50 text-amber-700 ring-amber-100",
};

function SubmissionList({ items, dict, locale }: { items: MySubmission[]; dict: Dictionary; locale: Locale }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon="plus"
        title={dict.me.emptySubmissionsTitle}
        description={dict.me.emptySubmissionsBody}
        action={
          <ButtonLink href="/submit" size="sm">
            {dict.common.submit}
          </ButtonLink>
        }
      />
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const href = item.resourceSlug
          ? `/resources/${item.resourceSlug}`
          : item.duplicateSlug
            ? `/resources/${item.duplicateSlug}`
            : "/submit";
        return (
          <li key={item.id}>
            <Card className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <Link href={href} className="block truncate text-[14px] font-medium text-ink hover:text-brand-700">
                  {item.title ?? item.url}
                </Link>
                <p className="mt-0.5 truncate text-[12px] text-muted">{item.url}</p>
                {item.errorMessage ? <p className="mt-1 text-[12px] text-rose-600">{item.errorMessage}</p> : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Chip className={SUBMISSION_TONE[item.status] ?? "bg-slate-50 text-slate-600 ring-slate-100"}>
                  {item.status.replaceAll("_", " ")}
                </Chip>
                <span className="text-[11px] text-muted">{relativeTime(item.createdAt, locale)}</span>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

function PathSuggestion({ path, dict }: { path: PathSummary; dict: Dictionary }) {
  return (
    <li>
      <Link href={`/paths/${path.slug}`} className="group flex items-start gap-2.5">
        <Icon name={path.icon} className="mt-0.5 size-4 text-brand-600" />
        <span className="min-w-0">
          <span className="block text-[13px] leading-snug font-medium text-ink group-hover:text-brand-700">
            {path.title}
          </span>
          <span className="mt-0.5 block text-[11px] text-muted">
            {path.resourceCount} {pluralNoun(dict, path.resourceCount, "resource")} · {compactNumber(path.learnersCount)}{" "}
            {pluralNoun(dict, path.learnersCount, "learner")}
          </span>
        </span>
      </Link>
    </li>
  );
}
