import { sql, type SQL } from "drizzle-orm";
import { getAIProvider } from "@/lib/ai/provider";
import { oneOf, query, queryOne } from "@/lib/db/query";
import type {
  Paginated,
  ResourceFacets,
  ResourceFilters,
  ResourceListItem,
  ResourceSort,
} from "./types";

/** Columns + joins shared by every resource projection. */
const CARD_COLUMNS = sql`
  r.id, r.slug, r.title, r.url, r.description, r.difficulty, r.language,
  r.price_model               AS "priceModel",
  r.estimated_minutes        AS "estimatedMinutes",
  r.author_name              AS "authorName",
  r.organization_name        AS "organizationName",
  r.thumbnail_url            AS "thumbnailUrl",
  r.is_official              AS "isOfficial",
  r.has_code                 AS "hasCode",
  r.is_editor_pick           AS "isEditorPick",
  ep.note                    AS "editorNote",
  r.quality_score::float     AS "qualityScore",
  r.community_score::float   AS "communityScore",
  r.ratings_count            AS "ratingsCount",
  r.trending_score::float    AS "trendingScore",
  r.views_count              AS "viewsCount",
  r.saves_count              AS "savesCount",
  r.published_at             AS "publishedAt",
  r.source_updated_at        AS "sourceUpdatedAt",
  r.metadata,
  rt.slug   AS "typeSlug",
  rt.name   AS "typeName",
  rt.accent AS "typeAccent",
  rt.icon   AS "typeIcon"
`;

const TOPICS_JSON = sql`
  COALESCE((
    SELECT json_agg(json_build_object('slug', t.slug, 'name', COALESCE(t.short_name, t.name), 'isPrimary', xt.is_primary)
                    ORDER BY xt.is_primary DESC, xt.relevance DESC)
    FROM resource_topics xt JOIN topics t ON t.id = xt.topic_id
    WHERE xt.resource_id = r.id
  ), '[]'::json) AS topics
`;

const BASE_FROM = sql`
  FROM resources r
  JOIN resource_types rt ON rt.id = r.resource_type_id
  LEFT JOIN editorial_picks ep ON ep.resource_id = r.id
`;

const PUBLISHED = sql`r.status = 'published' AND r.visibility = 'public'`;

function bookmarkColumn(userId?: string | null): SQL {
  if (!userId) return sql`NULL::learning_state AS "bookmarkState"`;
  return sql`(SELECT b.state FROM bookmarks b WHERE b.resource_id = r.id AND b.user_id = ${userId}) AS "bookmarkState"`;
}

/**
 * Topic filtering is subtree-aware: asking for `llm` returns resources tagged
 * with `transformer` or `inference` too, which is what makes a topic page feel
 * like a section of the map rather than a single tag.
 */
function topicSubtreeCondition(slug: string): SQL {
  return sql`EXISTS (
    SELECT 1 FROM resource_topics xt
    WHERE xt.resource_id = r.id AND xt.topic_id IN (
      WITH RECURSIVE subtree AS (
        SELECT id FROM topics WHERE slug = ${slug}
        UNION ALL
        SELECT c.id FROM topics c JOIN subtree s ON c.parent_id = s.id
      )
      SELECT id FROM subtree
    )
  )`;
}

function buildConditions(filters: ResourceFilters): SQL[] {
  const conditions: SQL[] = [PUBLISHED];

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    conditions.push(sql`(r.search_vector @@ websearch_to_tsquery('english', ${q}) OR r.title ILIKE ${`%${q}%`})`);
  }
  if (filters.topic) conditions.push(topicSubtreeCondition(filters.topic));
  if (filters.types?.length) conditions.push(oneOf(sql`rt.slug`, filters.types));
  if (filters.difficulties?.length) conditions.push(oneOf(sql`r.difficulty::text`, filters.difficulties));
  if (filters.languages?.length) conditions.push(oneOf(sql`r.language`, filters.languages));
  if (filters.free) conditions.push(sql`r.price_model = 'free'`);
  if (filters.hasCode) conditions.push(sql`r.has_code = true`);
  if (filters.official) conditions.push(sql`r.is_official = true`);
  if (filters.editorPicks) conditions.push(sql`r.is_editor_pick = true`);
  if (filters.updatedWithinDays) {
    conditions.push(
      sql`COALESCE(r.source_updated_at, r.published_at, r.created_at) > NOW() - ${`${filters.updatedWithinDays} days`}::interval`,
    );
  }

  return conditions;
}

function and(conditions: SQL[]): SQL {
  return sql.join(conditions, sql` AND `);
}

function orderBy(sort: ResourceSort = "recommended"): SQL {
  switch (sort) {
    case "trending":
      return sql`r.trending_score DESC, r.quality_score DESC`;
    case "newest":
      return sql`COALESCE(r.published_at, r.created_at) DESC`;
    case "popular":
      return sql`r.views_count DESC`;
    case "quality":
      return sql`r.quality_score DESC, r.views_count DESC`;
    case "rating":
      return sql`r.community_score DESC NULLS LAST, r.ratings_count DESC`;
    default:
      // "Recommended" blends editorial judgement, durable quality and current
      // momentum so the default ordering is neither a popularity contest nor a
      // frozen hall of fame.
      return sql`(
        r.quality_score * 0.45
        + LEAST(r.trending_score, 100) * 0.25
        + COALESCE(r.editor_score, 0) * 0.15
        + COALESCE(r.community_score, 0) * 20 * 0.10
        + LEAST(r.saves_count / 200.0, 1) * 100 * 0.05
      ) DESC`;
  }
}

export async function listResources(
  filters: ResourceFilters = {},
  userId?: string | null,
): Promise<Paginated<ResourceListItem>> {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(60, Math.max(1, filters.perPage ?? 20));
  const where = and(buildConditions(filters));

  const [countRow] = await query<{ total: number }>(sql`SELECT COUNT(*)::int AS total ${BASE_FROM} WHERE ${where}`);
  const total = countRow?.total ?? 0;

  const items = await query<ResourceListItem>(sql`
    SELECT ${CARD_COLUMNS}, ${TOPICS_JSON}, ${bookmarkColumn(userId)}
    ${BASE_FROM}
    WHERE ${where}
    ORDER BY ${orderBy(filters.sort)}
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
  `);

  return { items, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

/**
 * Facet counts for the filter sidebar.
 *
 * Each facet is counted against the other active filters but *not* against
 * itself, so ticking "Papers" does not collapse the type list to a single row.
 */
export async function getResourceFacets(filters: ResourceFilters = {}): Promise<ResourceFacets> {
  const withoutTypes = and(buildConditions({ ...filters, types: undefined }));
  const withoutDifficulty = and(buildConditions({ ...filters, difficulties: undefined }));
  const withoutLanguage = and(buildConditions({ ...filters, languages: undefined }));
  const full = and(buildConditions(filters));

  const [types, difficulties, languages, totals] = await Promise.all([
    query<{ value: string; label: string; count: number; accent: string; icon: string }>(sql`
      SELECT rt.slug AS value, rt.plural_name AS label, COUNT(r.id)::int AS count, rt.accent, rt.icon
      FROM resource_types rt
      LEFT JOIN resources r ON r.resource_type_id = rt.id AND ${withoutTypes}
      GROUP BY rt.id ORDER BY count DESC, rt.sort_order
    `),
    query<{ value: string; label: string; count: number }>(sql`
      SELECT r.difficulty::text AS value, r.difficulty::text AS label, COUNT(*)::int AS count
      ${BASE_FROM} WHERE ${withoutDifficulty}
      GROUP BY r.difficulty
      ORDER BY CASE r.difficulty WHEN 'beginner' THEN 1 WHEN 'intermediate' THEN 2 ELSE 3 END
    `),
    query<{ value: string; label: string; count: number }>(sql`
      SELECT r.language AS value, r.language AS label, COUNT(*)::int AS count
      ${BASE_FROM} WHERE ${withoutLanguage}
      GROUP BY r.language ORDER BY count DESC
    `),
    query<{ total: number }>(sql`SELECT COUNT(*)::int AS total ${BASE_FROM} WHERE ${full}`),
  ]);

  const LANGUAGE_NAMES: Record<string, string> = { en: "English", zh: "中文", es: "Español", fr: "Français", de: "Deutsch", ja: "日本語", ko: "한국어" };
  const DIFFICULTY_NAMES: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

  return {
    types: types.filter((bucket) => bucket.count > 0),
    difficulties: difficulties.map((bucket) => ({ ...bucket, label: DIFFICULTY_NAMES[bucket.value] ?? bucket.value })),
    languages: languages.map((bucket) => ({ ...bucket, label: LANGUAGE_NAMES[bucket.value] ?? bucket.value.toUpperCase() })),
    total: totals[0]?.total ?? 0,
  };
}

export type ResourceDetail = ResourceListItem & {
  summary: string | null;
  whyItMatters: string | null;
  keyTakeaways: string[] | null;
  whatYouLearn: string[] | null;
  prerequisites: string[] | null;
  bestFor: string[] | null;
  canonicalUrl: string;
  editorScore: number | null;
  completionsCount: number;
  clicksCount: number;
  createdAt: string;
  lastCheckedAt: string | null;
  typeDescription: string | null;
  submitter: { username: string; displayName: string; avatarUrl: string | null } | null;
};

export async function getResourceBySlug(slug: string, userId?: string | null): Promise<ResourceDetail | null> {
  return queryOne<ResourceDetail>(sql`
    SELECT ${CARD_COLUMNS}, ${TOPICS_JSON}, ${bookmarkColumn(userId)},
      r.summary, r.why_it_matters AS "whyItMatters", r.key_takeaways AS "keyTakeaways",
      r.what_you_learn AS "whatYouLearn", r.prerequisites, r.best_for AS "bestFor",
      r.canonical_url AS "canonicalUrl", r.editor_score::float AS "editorScore",
      r.completions_count AS "completionsCount", r.clicks_count AS "clicksCount",
      r.created_at AS "createdAt", r.last_checked_at AS "lastCheckedAt",
      rt.description AS "typeDescription",
      CASE WHEN p.id IS NULL THEN NULL ELSE json_build_object('username', p.username, 'displayName', p.display_name, 'avatarUrl', p.avatar_url) END AS submitter
    ${BASE_FROM}
    LEFT JOIN profiles p ON p.id = r.created_by
    WHERE r.slug = ${slug} AND r.visibility = 'public'
    LIMIT 1
  `);
}

/** Knowledge-graph neighbours in one direction of one relation type. */
export async function getRelatedByRelation(
  resourceId: string,
  relation: "prerequisite_of" | "next_step" | "related_to" | "explains" | "implements" | "alternative_to",
  direction: "outgoing" | "incoming" = "outgoing",
  limit = 5,
): Promise<Array<{ slug: string; title: string; typeName: string; typeAccent: string; typeIcon: string }>> {
  const join =
    direction === "outgoing"
      ? sql`JOIN resource_relations rel ON rel.to_resource_id = r.id AND rel.from_resource_id = ${resourceId}`
      : sql`JOIN resource_relations rel ON rel.from_resource_id = r.id AND rel.to_resource_id = ${resourceId}`;

  return query(sql`
    SELECT r.slug, r.title, rt.name AS "typeName", rt.accent AS "typeAccent", rt.icon AS "typeIcon"
    FROM resources r
    JOIN resource_types rt ON rt.id = r.resource_type_id
    ${join}
    WHERE rel.relation = ${relation} AND ${PUBLISHED}
    ORDER BY rel.weight DESC, r.quality_score DESC
    LIMIT ${limit}
  `);
}

/**
 * Similar resources by embedding distance, excluding anything already linked
 * explicitly in the graph so the two sections do not repeat each other.
 *
 * The similarity floor means a niche resource shows a short list — or none —
 * rather than six unrelated cards padding the page out.
 */
export async function getSimilarResources(resourceId: string, limit = 6): Promise<ResourceListItem[]> {
  const floor = getAIProvider().similarityFloor;
  return query<ResourceListItem>(sql`
    SELECT ${CARD_COLUMNS}, ${TOPICS_JSON}, NULL::learning_state AS "bookmarkState",
      1 - (e.embedding <=> target.embedding) AS similarity
    ${BASE_FROM}
    JOIN resource_embeddings e ON e.resource_id = r.id
    CROSS JOIN (SELECT embedding FROM resource_embeddings WHERE resource_id = ${resourceId}) target
    WHERE r.id <> ${resourceId}
      AND ${PUBLISHED}
      AND 1 - (e.embedding <=> target.embedding) >= ${floor}
      AND NOT EXISTS (
        SELECT 1 FROM resource_relations rel
        WHERE (rel.from_resource_id = ${resourceId} AND rel.to_resource_id = r.id)
           OR (rel.to_resource_id = ${resourceId} AND rel.from_resource_id = r.id)
      )
    ORDER BY e.embedding <=> target.embedding
    LIMIT ${limit}
  `);
}

export async function getResourceReviews(
  resourceId: string,
  limit = 12,
): Promise<Array<{ id: string; rating: number; body: string | null; createdAt: string; helpfulCount: number; author: { username: string; displayName: string; avatarUrl: string | null; headline: string | null } }>> {
  return query(sql`
    SELECT rv.id, rv.rating, rv.body, rv.created_at AS "createdAt", rv.helpful_count AS "helpfulCount",
      json_build_object('username', p.username, 'displayName', p.display_name, 'avatarUrl', p.avatar_url, 'headline', p.headline) AS author
    FROM reviews rv JOIN profiles p ON p.id = rv.user_id
    WHERE rv.resource_id = ${resourceId}
    ORDER BY rv.helpful_count DESC, rv.created_at DESC
    LIMIT ${limit}
  `);
}

/** "Who learns this": the audience mix, derived from real bookmark activity. */
export async function getResourceAudience(resourceId: string): Promise<{
  learners: Array<{ displayName: string; avatarUrl: string | null; headline: string | null; state: string }>;
  states: Array<{ state: string; count: number }>;
  pathsIncluding: Array<{ slug: string; title: string; icon: string; accent: string; stageTitle: string }>;
}> {
  const [learners, states, pathsIncluding] = await Promise.all([
    query<{ displayName: string; avatarUrl: string | null; headline: string | null; state: string }>(sql`
      SELECT p.display_name AS "displayName", p.avatar_url AS "avatarUrl", p.headline, b.state::text AS state
      FROM bookmarks b JOIN profiles p ON p.id = b.user_id
      WHERE b.resource_id = ${resourceId}
      ORDER BY b.updated_at DESC LIMIT 12
    `),
    query<{ state: string; count: number }>(sql`
      SELECT state::text AS state, COUNT(*)::int AS count FROM bookmarks
      WHERE resource_id = ${resourceId} GROUP BY state
    `),
    query<{ slug: string; title: string; icon: string; accent: string; stageTitle: string }>(sql`
      SELECT DISTINCT lp.slug, lp.title, lp.icon, lp.accent, s.title AS "stageTitle"
      FROM learning_path_resources lpr
      JOIN learning_path_stages s ON s.id = lpr.stage_id
      JOIN learning_paths lp ON lp.id = s.path_id
      WHERE lpr.resource_id = ${resourceId} AND lp.is_published
    `),
  ]);
  return { learners, states, pathsIncluding };
}

export async function getEditorPicks(limit = 5, userId?: string | null): Promise<ResourceListItem[]> {
  return query<ResourceListItem>(sql`
    SELECT ${CARD_COLUMNS}, ${TOPICS_JSON}, ${bookmarkColumn(userId)}
    ${BASE_FROM}
    WHERE ${PUBLISHED} AND r.is_editor_pick
    ORDER BY ep.rank NULLS LAST, r.quality_score DESC
    LIMIT ${limit}
  `);
}

export async function getResourceTypes(): Promise<
  Array<{ slug: string; name: string; pluralName: string; icon: string; accent: string; description: string | null; count: number; isPrimaryNav: boolean }>
> {
  return query(sql`
    SELECT rt.slug, rt.name, rt.plural_name AS "pluralName", rt.icon, rt.accent, rt.description,
      rt.is_primary_nav AS "isPrimaryNav",
      COUNT(r.id)::int AS count
    FROM resource_types rt
    LEFT JOIN resources r ON r.resource_type_id = rt.id AND r.status = 'published' AND r.visibility = 'public'
    GROUP BY rt.id
    ORDER BY rt.sort_order
  `);
}

export async function getPlatformStats(): Promise<{
  resources: number;
  contributors: number;
  learners: number;
  topics: number;
  paths: number;
  countries: number;
}> {
  const [row] = await query<{
    resources: number;
    contributors: number;
    learners: number;
    topics: number;
    paths: number;
  }>(sql`
    SELECT
      (SELECT COUNT(*)::int FROM resources WHERE status = 'published' AND visibility = 'public') AS resources,
      (SELECT COUNT(DISTINCT created_by)::int FROM resources WHERE created_by IS NOT NULL) AS contributors,
      (SELECT COUNT(*)::int FROM profiles) AS learners,
      (SELECT COUNT(*)::int FROM topics) AS topics,
      (SELECT COUNT(*)::int FROM learning_paths WHERE is_published) AS paths
  `);
  return { ...row, countries: 0 };
}
