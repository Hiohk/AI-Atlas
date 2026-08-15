import { sql } from "drizzle-orm";
import { query, queryOne } from "@/lib/db/query";
import type { SubmissionProgress, SubmissionStatus } from "@/lib/pipeline/stages";

export async function getSubmissionProgress(id: string, userId: string): Promise<SubmissionProgress | null> {
  return queryOne<SubmissionProgress>(sql`
    SELECT s.id, s.status::text AS status, s.url, s.risk_level AS "riskLevel",
      s.error_message AS "errorMessage", s.duplicate_similarity AS "duplicateSimilarity",
      s.created_at AS "createdAt", s.draft,
      d.slug AS "duplicateSlug", d.title AS "duplicateTitle", r.slug AS "resourceSlug",
      COALESCE((
        SELECT json_agg(json_build_object('stage', e.stage, 'status', e.status, 'message', e.message,
                                          'durationMs', e.duration_ms) ORDER BY e.created_at)
        FROM submission_events e WHERE e.submission_id = s.id
      ), '[]'::json) AS events
    FROM submissions s
    LEFT JOIN resources d ON d.id = s.duplicate_of_id
    LEFT JOIN resources r ON r.id = s.resource_id
    WHERE s.id = ${id} AND s.submitted_by = ${userId}
  `);
}

export type MySubmission = {
  id: string;
  url: string;
  status: SubmissionStatus;
  createdAt: string;
  errorMessage: string | null;
  title: string | null;
  resourceSlug: string | null;
  duplicateSlug: string | null;
};

export async function listMySubmissions(userId: string, limit = 12): Promise<MySubmission[]> {
  return query<MySubmission>(sql`
    SELECT s.id, s.url, s.status::text AS status, s.created_at AS "createdAt",
      s.error_message AS "errorMessage",
      COALESCE(r.title, s.draft->>'title') AS title,
      r.slug AS "resourceSlug", d.slug AS "duplicateSlug"
    FROM submissions s
    LEFT JOIN resources r ON r.id = s.resource_id
    LEFT JOIN resources d ON d.id = s.duplicate_of_id
    WHERE s.submitted_by = ${userId}
    ORDER BY s.created_at DESC
    LIMIT ${limit}
  `);
}

export async function getSubmissionStats(userId: string) {
  return queryOne<{ total: number; published: number; pending: number; todayCount: number }>(sql`
    SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'published')::int AS published,
      COUNT(*) FILTER (WHERE status IN ('submitted','fetching','analyzing','duplicate_check','ready_for_review'))::int AS pending,
      COUNT(*) FILTER (WHERE created_at > CURRENT_DATE)::int AS "todayCount"
    FROM submissions WHERE submitted_by = ${userId}
  `);
}
