import { sql } from "drizzle-orm";
import { query } from "@/lib/db/query";
import type { ResourceListItem } from "./types";

export type TrendingWindow = 1 | 7 | 30 | 0;

export const TRENDING_WINDOWS: Array<{ value: TrendingWindow; label: string }> = [
  { value: 1, label: "24h" },
  { value: 7, label: "7d" },
  { value: 30, label: "30d" },
  { value: 0, label: "All time" },
];

export type TrendingTopic = {
  slug: string;
  name: string;
  tagline: string | null;
  accent: string;
  icon: string;
  views: number;
  /** Percentage change against the preceding window of equal length. */
  growth: number;
  spark: number[];
  resourceCount: number;
};

/**
 * Ranks topics by acceleration over the requested window, comparing it against
 * the window immediately before. The sparkline is returned with the row so the
 * list renders in a single round trip.
 */
export async function getTrendingTopics(windowDays: TrendingWindow = 7, limit = 8): Promise<TrendingTopic[]> {
  const days = windowDays === 0 ? 60 : Math.max(1, windowDays);
  return query<TrendingTopic>(sql`
    WITH windows AS (
      SELECT topic_id,
        SUM(CASE WHEN day > CURRENT_DATE - ${days}::int THEN views ELSE 0 END)::int AS recent_views,
        SUM(CASE WHEN day <= CURRENT_DATE - ${days}::int AND day > CURRENT_DATE - ${days * 2}::int THEN views ELSE 0 END)::int AS prior_views,
        SUM(CASE WHEN day > CURRENT_DATE - ${days}::int THEN attention ELSE 0 END)::float AS recent_attention
      FROM topic_daily_stats GROUP BY topic_id
    ),
    spark AS (
      SELECT topic_id, json_agg(views ORDER BY day) AS points
      FROM (SELECT topic_id, day, views FROM topic_daily_stats WHERE day > CURRENT_DATE - 21) s
      GROUP BY topic_id
    )
    SELECT t.slug, COALESCE(t.short_name, t.name) AS name, t.tagline, t.accent, t.icon,
      w.recent_views AS views,
      CASE WHEN w.prior_views > 0
        THEN ROUND(100.0 * (w.recent_views - w.prior_views) / w.prior_views)::int
        ELSE 100 END AS growth,
      COALESCE(spark.points, '[]'::json) AS spark,
      (SELECT COUNT(*)::int FROM resource_topics xt JOIN resources r ON r.id = xt.resource_id
        WHERE xt.topic_id = t.id AND r.status = 'published') AS "resourceCount"
    FROM topics t
    JOIN windows w ON w.topic_id = t.id
    LEFT JOIN spark ON spark.topic_id = t.id
    WHERE w.recent_views > 0
    ORDER BY growth DESC, w.recent_attention DESC
    LIMIT ${limit}
  `);
}

/** Topics with strong search demand but thin coverage — the editorial backlog. */
export async function getTopicGaps(limit = 6): Promise<Array<{ query: string; searches: number; results: number }>> {
  return query(sql`
    SELECT normalized_query AS query, COUNT(*)::int AS searches, MAX(results_count)::int AS results
    FROM search_queries
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY normalized_query
    HAVING MAX(results_count) <= 6
    ORDER BY searches DESC
    LIMIT ${limit}
  `);
}

export type TrendingResource = ResourceListItem & { windowViews: number; windowSaves: number; growth: number };

export async function getTrendingResources(windowDays: TrendingWindow = 7, limit = 10): Promise<TrendingResource[]> {
  const days = windowDays === 0 ? 3650 : Math.max(1, windowDays);
  return query<TrendingResource>(sql`
    WITH windows AS (
      SELECT resource_id,
        SUM(CASE WHEN day > CURRENT_DATE - ${days}::int THEN views ELSE 0 END)::int AS window_views,
        SUM(CASE WHEN day > CURRENT_DATE - ${days}::int THEN saves ELSE 0 END)::int AS window_saves,
        SUM(CASE WHEN day <= CURRENT_DATE - ${days}::int AND day > CURRENT_DATE - ${days * 2}::int THEN views ELSE 0 END)::int AS prior_views
      FROM resource_daily_stats GROUP BY resource_id
    )
    SELECT r.id, r.slug, r.title, r.url, r.description, r.difficulty, r.language,
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
      NULL::learning_state AS "bookmarkState",
      COALESCE(w.window_views, 0) AS "windowViews",
      COALESCE(w.window_saves, 0) AS "windowSaves",
      CASE WHEN w.prior_views > 0 THEN ROUND(100.0 * (w.window_views - w.prior_views) / w.prior_views)::int ELSE 100 END AS growth
    FROM resources r
    JOIN resource_types rt ON rt.id = r.resource_type_id
    LEFT JOIN windows w ON w.resource_id = r.id
    WHERE r.status = 'published' AND r.visibility = 'public'
    ORDER BY ${windowDays === 0 ? sql`r.views_count DESC` : sql`r.trending_score DESC, w.window_views DESC NULLS LAST`}
    LIMIT ${limit}
  `);
}

export type HeatmapCell = { topic: string; day: string; value: number };

/**
 * Topic attention over time, normalised per topic so a small topic's spike is
 * still visible next to a large topic's baseline.
 */
export async function getAttentionHeatmap(days = 35, topicLimit = 8): Promise<{
  topics: Array<{ slug: string; name: string }>;
  days: string[];
  cells: HeatmapCell[];
}> {
  const rows = await query<{ slug: string; name: string; day: string; value: number }>(sql`
    WITH top_topics AS (
      SELECT s.topic_id, SUM(s.attention) AS total
      FROM topic_daily_stats s
      JOIN topics t ON t.id = s.topic_id AND t.parent_id IS NULL
      WHERE s.day > CURRENT_DATE - ${days}::int
      GROUP BY s.topic_id ORDER BY total DESC LIMIT ${topicLimit}
    )
    SELECT t.slug, COALESCE(t.short_name, t.name) AS name, s.day::text AS day,
      (s.attention / NULLIF(MAX(s.attention) OVER (PARTITION BY s.topic_id), 0))::float AS value
    FROM topic_daily_stats s
    JOIN top_topics tt ON tt.topic_id = s.topic_id
    JOIN topics t ON t.id = s.topic_id
    WHERE s.day > CURRENT_DATE - ${days}::int
    ORDER BY tt.total DESC, s.day
  `);

  const topics: Array<{ slug: string; name: string }> = [];
  const daySet = new Set<string>();
  for (const row of rows) {
    if (!topics.some((topic) => topic.slug === row.slug)) topics.push({ slug: row.slug, name: row.name });
    daySet.add(row.day);
  }

  return {
    topics,
    days: [...daySet].sort(),
    cells: rows.map((row) => ({ topic: row.slug, day: row.day, value: row.value ?? 0 })),
  };
}
