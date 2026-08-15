import { sql } from "drizzle-orm";
import { queryOne } from "@/lib/db/query";
import type { UserRole } from "@/lib/db/schema";

type Bucket = { tokens: number; resetAt: number };

/**
 * Process-local sliding window. Adequate for a single Next.js instance and for
 * local development; on more than one instance this must move to Redis or
 * Postgres, since each process would otherwise grant the full allowance.
 */
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { tokens: limit - 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  if (bucket.tokens <= 0) {
    return { ok: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.tokens -= 1;
  return { ok: true, retryAfterMs: 0 };
}

// Opportunistic cleanup so the map cannot grow without bound.
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  }, 60_000);
  timer.unref?.();
}

/** Daily submission quotas: trust earns throughput. */
export const SUBMISSION_QUOTAS: Record<UserRole, number> = {
  user: 10,
  contributor: 50,
  editor: 200,
  admin: 1000,
};

export async function checkSubmissionQuota(
  userId: string,
  role: UserRole,
  isTrusted: boolean,
): Promise<{ ok: boolean; used: number; limit: number }> {
  const limit = isTrusted ? Math.max(SUBMISSION_QUOTAS[role], 100) : SUBMISSION_QUOTAS[role];
  const row = await queryOne<{ used: number }>(sql`
    SELECT COUNT(*)::int AS used FROM submissions
    WHERE submitted_by = ${userId} AND created_at > NOW() - INTERVAL '24 hours'
  `);
  const used = row?.used ?? 0;
  return { ok: used < limit, used, limit };
}
