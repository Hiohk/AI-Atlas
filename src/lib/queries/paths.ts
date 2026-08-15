import { sql } from "drizzle-orm";
import { query, queryOne } from "@/lib/db/query";
import type { ResourceListItem } from "./types";

export type PathSummary = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedWeeks: number | null;
  icon: string;
  accent: string;
  category: string;
  isPopular: boolean;
  learnersCount: number;
  outcomes: string[] | null;
  audience: string[] | null;
  resourceCount: number;
  stageCount: number;
  /** Null unless the viewer is enrolled. */
  progress: number | null;
  completedCount: number | null;
};

/**
 * Progress is computed from the viewer's completed bookmarks intersected with
 * the path's resources, so a resource finished elsewhere still counts here.
 */
function progressColumns(userId?: string | null) {
  if (!userId) return sql`NULL::int AS progress, NULL::int AS "completedCount"`;
  return sql`
    (SELECT COUNT(*)::int FROM learning_path_stages s
       JOIN learning_path_resources lpr ON lpr.stage_id = s.id
       JOIN bookmarks b ON b.resource_id = lpr.resource_id AND b.user_id = ${userId} AND b.state = 'completed'
      WHERE s.path_id = lp.id) AS "completedCount",
    CASE WHEN EXISTS (SELECT 1 FROM path_enrollments e WHERE e.path_id = lp.id AND e.user_id = ${userId})
      THEN COALESCE(ROUND(100.0 * (
        SELECT COUNT(*) FROM learning_path_stages s
          JOIN learning_path_resources lpr ON lpr.stage_id = s.id
          JOIN bookmarks b ON b.resource_id = lpr.resource_id AND b.user_id = ${userId} AND b.state = 'completed'
         WHERE s.path_id = lp.id
      ) / NULLIF((
        SELECT COUNT(*) FROM learning_path_stages s
          JOIN learning_path_resources lpr ON lpr.stage_id = s.id
         WHERE s.path_id = lp.id
      ), 0))::int, 0)
      ELSE NULL END AS progress
  `;
}

const PATH_COLUMNS = sql`
  lp.id, lp.slug, lp.title, lp.subtitle, lp.description, lp.difficulty, lp.icon, lp.accent, lp.category,
  lp.estimated_weeks AS "estimatedWeeks",
  lp.is_popular      AS "isPopular",
  lp.learners_count  AS "learnersCount",
  lp.outcomes, lp.audience,
  (SELECT COUNT(*)::int FROM learning_path_stages s JOIN learning_path_resources lpr ON lpr.stage_id = s.id WHERE s.path_id = lp.id) AS "resourceCount",
  (SELECT COUNT(*)::int FROM learning_path_stages s WHERE s.path_id = lp.id) AS "stageCount"
`;

export async function listPaths(
  { category, difficulty, sort = "popular" }: { category?: string; difficulty?: string; sort?: "popular" | "newest" | "duration" } = {},
  userId?: string | null,
): Promise<PathSummary[]> {
  const conditions = [sql`lp.is_published`];
  if (category && category !== "all") conditions.push(sql`lp.category = ${category}`);
  if (difficulty && difficulty !== "all") conditions.push(sql`lp.difficulty::text = ${difficulty}`);

  const order =
    sort === "newest" ? sql`lp.created_at DESC` : sort === "duration" ? sql`lp.estimated_weeks ASC` : sql`lp.is_popular DESC, lp.learners_count DESC`;

  return query<PathSummary>(sql`
    SELECT ${PATH_COLUMNS}, ${progressColumns(userId)}
    FROM learning_paths lp
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY ${order}, lp.sort_order
  `);
}

export type PathStage = {
  id: string;
  position: number;
  title: string;
  description: string | null;
  estimatedWeeks: number | null;
  resources: Array<ResourceListItem & { isOptional: boolean; note: string | null }>;
};

export type PathDetail = PathSummary & {
  isEnrolled: boolean;
  stages: PathStage[];
  totalMinutes: number;
};

export async function getPathBySlug(slug: string, userId?: string | null): Promise<PathDetail | null> {
  const path = await queryOne<PathSummary & { isEnrolled: boolean; totalMinutes: number }>(sql`
    SELECT ${PATH_COLUMNS}, ${progressColumns(userId)},
      ${userId ? sql`EXISTS (SELECT 1 FROM path_enrollments e WHERE e.path_id = lp.id AND e.user_id = ${userId})` : sql`FALSE`} AS "isEnrolled",
      COALESCE((SELECT SUM(r.estimated_minutes)::int
        FROM learning_path_stages s
        JOIN learning_path_resources lpr ON lpr.stage_id = s.id
        JOIN resources r ON r.id = lpr.resource_id
        WHERE s.path_id = lp.id), 0) AS "totalMinutes"
    FROM learning_paths lp
    WHERE lp.slug = ${slug} AND lp.is_published
    LIMIT 1
  `);
  if (!path) return null;

  const stages = await query<Omit<PathStage, "resources">>(sql`
    SELECT id, position, title, description, estimated_weeks AS "estimatedWeeks"
    FROM learning_path_stages WHERE path_id = ${path.id} ORDER BY position
  `);

  const resources = await query<ResourceListItem & { stageId: string; isOptional: boolean; note: string | null; position: number }>(sql`
    SELECT lpr.stage_id AS "stageId", lpr.is_optional AS "isOptional", lpr.note, lpr.position,
      r.id, r.slug, r.title, r.url, r.description, r.difficulty, r.language,
      r.price_model AS "priceModel", r.estimated_minutes AS "estimatedMinutes",
      r.author_name AS "authorName", r.organization_name AS "organizationName",
      r.thumbnail_url AS "thumbnailUrl", r.is_official AS "isOfficial", r.has_code AS "hasCode",
      r.is_editor_pick AS "isEditorPick", NULL::text AS "editorNote",
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
      ${userId ? sql`(SELECT b.state FROM bookmarks b WHERE b.resource_id = r.id AND b.user_id = ${userId})` : sql`NULL::learning_state`} AS "bookmarkState"
    FROM learning_path_resources lpr
    JOIN learning_path_stages s ON s.id = lpr.stage_id
    JOIN resources r ON r.id = lpr.resource_id
    JOIN resource_types rt ON rt.id = r.resource_type_id
    WHERE s.path_id = ${path.id}
    ORDER BY lpr.position
  `);

  return {
    ...path,
    stages: stages.map((stage) => ({
      ...stage,
      resources: resources.filter((resource) => resource.stageId === stage.id),
    })),
  };
}

export async function getPathSlugs(): Promise<string[]> {
  const rows = await query<{ slug: string }>(sql`SELECT slug FROM learning_paths WHERE is_published`);
  return rows.map((row) => row.slug);
}

export async function getPathCategories(): Promise<Array<{ value: string; label: string; count: number }>> {
  const rows = await query<{ value: string; count: number }>(sql`
    SELECT category AS value, COUNT(*)::int AS count FROM learning_paths WHERE is_published GROUP BY category ORDER BY count DESC
  `);
  return rows.map((row) => ({ ...row, label: row.value.replace(/(^|[-_])(\w)/g, (_, __, c) => ` ${c.toUpperCase()}`).trim() }));
}
