"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { execute, query, queryOne } from "@/lib/db/query";
import { getCurrentUser } from "@/lib/auth/session";
import { decrementSaves, track } from "@/lib/analytics/track";
import type { LearningState } from "@/lib/db/schema";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string; requiresAuth?: boolean };

const stateSchema = z.enum(["saved", "in_progress", "completed"]);

/**
 * Cycles a resource through the learning states, or removes it when `null` is
 * passed. Returns the new state so the client can update without a refetch.
 */
export async function setLearningState(
  resourceId: string,
  next: LearningState | null,
): Promise<ActionResult<{ state: LearningState | null }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to build your library.", requiresAuth: true };

  if (!z.string().uuid().safeParse(resourceId).success) return { ok: false, error: "Unknown resource." };

  const existing = await queryOne<{ state: LearningState }>(
    sql`SELECT state FROM bookmarks WHERE user_id = ${user.id} AND resource_id = ${resourceId}`,
  );

  if (next === null) {
    await execute(sql`DELETE FROM bookmarks WHERE user_id = ${user.id} AND resource_id = ${resourceId}`);
    if (existing) await decrementSaves(resourceId);
    await track("resource_unsave", { userId: user.id, resourceId });
    revalidateLibrary();
    return { ok: true, data: { state: null } };
  }

  const parsed = stateSchema.safeParse(next);
  if (!parsed.success) return { ok: false, error: "Unknown state." };
  const state = parsed.data;

  await execute(sql`
    INSERT INTO bookmarks (user_id, resource_id, state, completed_at)
    VALUES (${user.id}, ${resourceId}, ${state}, ${state === "completed" ? sql`NOW()` : sql`NULL`})
    ON CONFLICT (user_id, resource_id) DO UPDATE
      SET state = ${state},
          updated_at = NOW(),
          completed_at = ${state === "completed" ? sql`COALESCE(bookmarks.completed_at, NOW())` : sql`NULL`}
  `);

  if (!existing) await track("resource_save", { userId: user.id, resourceId });
  if (state === "completed" && existing?.state !== "completed") {
    await track("resource_complete", { userId: user.id, resourceId });
  }

  revalidateLibrary();
  return { ok: true, data: { state } };
}

/** Save ⇄ unsave in one call, for the bookmark icon on cards. */
export async function toggleSaved(resourceId: string): Promise<ActionResult<{ state: LearningState | null }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to save resources.", requiresAuth: true };

  const existing = await queryOne<{ state: LearningState }>(
    sql`SELECT state FROM bookmarks WHERE user_id = ${user.id} AND resource_id = ${resourceId}`,
  );
  return setLearningState(resourceId, existing ? null : "saved");
}

export async function enrollInPath(pathId: string): Promise<ActionResult<{ enrolled: boolean }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to track your progress.", requiresAuth: true };

  const existing = await queryOne(sql`SELECT 1 FROM path_enrollments WHERE user_id = ${user.id} AND path_id = ${pathId}`);
  if (existing) {
    await execute(sql`DELETE FROM path_enrollments WHERE user_id = ${user.id} AND path_id = ${pathId}`);
    revalidateLibrary();
    return { ok: true, data: { enrolled: false } };
  }

  await execute(sql`INSERT INTO path_enrollments (user_id, path_id) VALUES (${user.id}, ${pathId})`);
  await track("path_start", { userId: user.id, pathId });
  revalidateLibrary();
  return { ok: true, data: { enrolled: true } };
}

const reviewSchema = z.object({
  resourceId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().max(2000).optional(),
});

export async function submitReview(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to leave a review.", requiresAuth: true };

  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Pick a rating between 1 and 5." };
  const { resourceId, rating, body } = parsed.data;

  await execute(sql`
    INSERT INTO reviews (resource_id, user_id, rating, body)
    VALUES (${resourceId}, ${user.id}, ${rating}, ${body ?? null})
    ON CONFLICT (resource_id, user_id) DO UPDATE SET rating = ${rating}, body = ${body ?? null}, created_at = NOW()
  `);

  // The displayed rating is always derived from the reviews table.
  await execute(sql`
    UPDATE resources r SET community_score = agg.avg, ratings_count = agg.count
    FROM (SELECT ROUND(AVG(rating)::numeric, 2) avg, COUNT(*)::int count FROM reviews WHERE resource_id = ${resourceId}) agg
    WHERE r.id = ${resourceId}
  `);

  const slug = await queryOne<{ slug: string }>(sql`SELECT slug FROM resources WHERE id = ${resourceId}`);
  if (slug) revalidatePath(`/resources/${slug.slug}`);
  return { ok: true };
}

/** Outbound click tracking; the redirect itself happens on the client. */
export async function recordResourceClick(resourceId: string): Promise<void> {
  const user = await getCurrentUser();
  await track("resource_click", { userId: user?.id, resourceId });
}

export async function getLibrarySummary(): Promise<{
  saved: number;
  inProgress: number;
  completed: number;
  submissions: number;
} | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const [row] = await query<{ saved: number; inProgress: number; completed: number; submissions: number }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE state = 'saved')::int AS saved,
      COUNT(*) FILTER (WHERE state = 'in_progress')::int AS "inProgress",
      COUNT(*) FILTER (WHERE state = 'completed')::int AS completed,
      (SELECT COUNT(*)::int FROM submissions WHERE submitted_by = ${user.id}) AS submissions
    FROM bookmarks WHERE user_id = ${user.id}
  `);
  return row;
}

function revalidateLibrary() {
  revalidatePath("/me");
  revalidatePath("/paths");
}
