import { sql } from "drizzle-orm";
import { query, queryOne } from "@/lib/db/query";

export type AdminOverview = {
  awaitingReview: number;
  inPipeline: number;
  failed: number;
  publishedTotal: number;
  publishedThisWeek: number;
  rejectedThisWeek: number;
  submissionsThisWeek: number;
  avgQuality: number;
  highRisk: number;
  openReports: number;
  contributors: number;
  savesThisWeek: number;
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const row = await queryOne<AdminOverview>(sql`
    SELECT
      (SELECT COUNT(*)::int FROM submissions WHERE status = 'ready_for_review') AS "awaitingReview",
      (SELECT COUNT(*)::int FROM submissions WHERE status IN ('submitted','fetching','analyzing','duplicate_check')) AS "inPipeline",
      (SELECT COUNT(*)::int FROM submissions WHERE status = 'failed') AS failed,
      (SELECT COUNT(*)::int FROM resources WHERE status = 'published') AS "publishedTotal",
      (SELECT COUNT(*)::int FROM resources WHERE status = 'published' AND created_at > NOW() - INTERVAL '7 days') AS "publishedThisWeek",
      (SELECT COUNT(*)::int FROM submissions WHERE status = 'rejected' AND updated_at > NOW() - INTERVAL '7 days') AS "rejectedThisWeek",
      (SELECT COUNT(*)::int FROM submissions WHERE created_at > NOW() - INTERVAL '7 days') AS "submissionsThisWeek",
      (SELECT COALESCE(ROUND(AVG(quality_score))::int, 0) FROM resources WHERE status = 'published') AS "avgQuality",
      (SELECT COUNT(*)::int FROM submissions WHERE risk_level = 'high' AND status = 'ready_for_review') AS "highRisk",
      (SELECT COUNT(*)::int FROM reports WHERE status = 'open') AS "openReports",
      (SELECT COUNT(DISTINCT submitted_by)::int FROM submissions WHERE submitted_by IS NOT NULL) AS contributors,
      (SELECT COALESCE(SUM(saves)::int, 0) FROM resource_daily_stats WHERE day > CURRENT_DATE - 7) AS "savesThisWeek"
  `);
  return (
    row ?? {
      awaitingReview: 0, inPipeline: 0, failed: 0, publishedTotal: 0, publishedThisWeek: 0,
      rejectedThisWeek: 0, submissionsThisWeek: 0, avgQuality: 0, highRisk: 0, openReports: 0,
      contributors: 0, savesThisWeek: 0,
    }
  );
}

/** Counts by pipeline stage, for the funnel on the admin dashboard. */
export async function getPipelineFunnel(): Promise<Array<{ status: string; count: number }>> {
  return query(sql`
    SELECT status::text AS status, COUNT(*)::int AS count
    FROM submissions
    GROUP BY status
    ORDER BY CASE status
      WHEN 'submitted' THEN 1 WHEN 'fetching' THEN 2 WHEN 'analyzing' THEN 3
      WHEN 'duplicate_check' THEN 4 WHEN 'ready_for_review' THEN 5 WHEN 'approved' THEN 6
      WHEN 'published' THEN 7 WHEN 'rejected' THEN 8 ELSE 9 END
  `);
}

export type QueueItem = {
  id: string;
  url: string;
  canonicalUrl: string | null;
  note: string | null;
  status: string;
  riskLevel: string;
  errorMessage: string | null;
  attempts: number;
  createdAt: string;
  duplicateSimilarity: number | null;
  duplicateOf: { slug: string; title: string } | null;
  submitter: { username: string; displayName: string; avatarUrl: string | null; role: string } | null;
  draft: {
    title?: string;
    description?: string;
    summary?: string;
    whyItMatters?: string;
    type?: string;
    topics?: string[];
    difficulty?: string;
    language?: string;
    qualityScore?: number;
    confidence?: number;
    whatYouLearn?: string[];
    prerequisites?: string[];
    authorName?: string | null;
    organizationName?: string | null;
    estimatedMinutes?: number | null;
  } | null;
  events: Array<{ stage: string; status: string; message: string | null; durationMs: number | null; createdAt: string }>;
  analysis: { provider: string; model: string; latencyMs: number | null } | null;
};

export async function listReviewQueue({
  status = "ready_for_review",
  limit = 30,
}: { status?: string; limit?: number } = {}): Promise<QueueItem[]> {
  const statusFilter =
    status === "all"
      ? sql`TRUE`
      : status === "active"
        ? sql`s.status IN ('submitted','fetching','analyzing','duplicate_check','ready_for_review')`
        : sql`s.status = ${status}::submission_status`;

  return query<QueueItem>(sql`
    SELECT s.id, s.url, s.canonical_url AS "canonicalUrl", s.note, s.status::text AS status,
      s.risk_level AS "riskLevel", s.error_message AS "errorMessage", s.attempts,
      s.created_at AS "createdAt", s.duplicate_similarity AS "duplicateSimilarity", s.draft,
      CASE WHEN d.id IS NULL THEN NULL ELSE json_build_object('slug', d.slug, 'title', d.title) END AS "duplicateOf",
      CASE WHEN p.id IS NULL THEN NULL ELSE json_build_object('username', p.username, 'displayName', p.display_name, 'avatarUrl', p.avatar_url, 'role', p.role) END AS submitter,
      COALESCE((
        SELECT json_agg(json_build_object('stage', e.stage, 'status', e.status, 'message', e.message,
                                          'durationMs', e.duration_ms, 'createdAt', e.created_at) ORDER BY e.created_at)
        FROM submission_events e WHERE e.submission_id = s.id
      ), '[]'::json) AS events,
      (SELECT json_build_object('provider', a.provider, 'model', a.model, 'latencyMs', a.latency_ms)
         FROM ai_analyses a WHERE a.submission_id = s.id ORDER BY a.created_at DESC LIMIT 1) AS analysis
    FROM submissions s
    LEFT JOIN resources d ON d.id = s.duplicate_of_id
    LEFT JOIN profiles p ON p.id = s.submitted_by
    WHERE ${statusFilter}
    ORDER BY (s.risk_level = 'high') DESC, s.created_at DESC
    LIMIT ${limit}
  `);
}

export type ManagedResource = {
  id: string;
  slug: string;
  title: string;
  status: string;
  typeName: string;
  typeAccent: string;
  difficulty: string;
  qualityScore: number;
  viewsCount: number;
  savesCount: number;
  isEditorPick: boolean;
  createdAt: string;
  primaryTopic: string | null;
};

export async function listManagedResources({
  q,
  status,
  limit = 40,
}: { q?: string; status?: string; limit?: number } = {}): Promise<ManagedResource[]> {
  const conditions = [sql`TRUE`];
  if (q?.trim()) conditions.push(sql`r.title ILIKE ${`%${q.trim()}%`}`);
  if (status && status !== "all") conditions.push(sql`r.status = ${status}::resource_status`);

  return query<ManagedResource>(sql`
    SELECT r.id, r.slug, r.title, r.status::text AS status, r.difficulty::text AS difficulty,
      r.quality_score::float AS "qualityScore", r.views_count AS "viewsCount", r.saves_count AS "savesCount",
      r.is_editor_pick AS "isEditorPick", r.created_at AS "createdAt",
      rt.name AS "typeName", rt.accent AS "typeAccent",
      (SELECT COALESCE(t.short_name, t.name) FROM resource_topics xt JOIN topics t ON t.id = xt.topic_id
        WHERE xt.resource_id = r.id ORDER BY xt.is_primary DESC LIMIT 1) AS "primaryTopic"
    FROM resources r JOIN resource_types rt ON rt.id = r.resource_type_id
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY r.created_at DESC
    LIMIT ${limit}
  `);
}

export async function listManagedTopics(): Promise<
  Array<{ slug: string; name: string; parentName: string | null; icon: string; accent: string; resourceCount: number; isFeatured: boolean }>
> {
  return query(sql`
    SELECT t.slug, t.name, t.icon, t.accent, t.is_featured AS "isFeatured",
      (SELECT name FROM topics p WHERE p.id = t.parent_id) AS "parentName",
      (SELECT COUNT(*)::int FROM resource_topics xt WHERE xt.topic_id = t.id) AS "resourceCount"
    FROM topics t
    ORDER BY t.parent_id NULLS FIRST, t.sort_order
  `);
}

/** Top queries of the last 30 days, with click-through — the demand signal. */
export async function getSearchInsights(limit = 12): Promise<
  Array<{ query: string; searches: number; avgResults: number; clickThrough: number }>
> {
  return query(sql`
    SELECT normalized_query AS query,
      COUNT(*)::int AS searches,
      ROUND(AVG(results_count))::int AS "avgResults",
      ROUND(100.0 * COUNT(clicked_resource_id) / COUNT(*))::int AS "clickThrough"
    FROM search_queries
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY normalized_query
    ORDER BY searches DESC
    LIMIT ${limit}
  `);
}

export async function listUsers(limit = 40): Promise<
  Array<{ id: string; username: string; displayName: string; email: string; role: string; avatarUrl: string | null; isTrusted: boolean; submissions: number; createdAt: string }>
> {
  return query(sql`
    SELECT p.id, p.username, p.display_name AS "displayName", p.email, p.role::text AS role,
      p.avatar_url AS "avatarUrl", p.is_trusted AS "isTrusted", p.created_at AS "createdAt",
      (SELECT COUNT(*)::int FROM submissions s WHERE s.submitted_by = p.id) AS submissions
    FROM profiles p
    ORDER BY p.created_at
    LIMIT ${limit}
  `);
}
