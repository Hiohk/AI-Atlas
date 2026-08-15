"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { track } from "@/lib/analytics/track";
import { getCurrentUser, requireRole } from "@/lib/auth/session";
import { assertSafeUrl, canonicalizeUrl, UnsafeUrlError } from "@/lib/crawler/url";
import { execute, query, queryOne } from "@/lib/db/query";
import { processSubmission, publishSubmission, rejectSubmission } from "@/lib/pipeline/ingest";
import { checkSubmissionQuota, rateLimit } from "@/lib/rate-limit";

export type SubmitState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "queued"; submissionId: string; message: string };

const submitSchema = z.object({
  url: z.string().min(4, "Paste a URL to get started."),
  note: z.string().max(500).optional(),
});

/**
 * The user's request ends as soon as the submission row exists. Fetching and
 * analysis run after the response via `after()`, which is the framework-native
 * stand-in for the job queue this would use in production.
 */
export async function submitResourceAction(_state: SubmitState, formData: FormData): Promise<SubmitState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Sign in to submit a resource." };

  const parsed = submitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the URL." };

  const limit = rateLimit(`submit:${user.id}`, 5, 60_000);
  if (!limit.ok) {
    return { status: "error", message: `Slow down for ${Math.ceil(limit.retryAfterMs / 1000)}s before submitting again.` };
  }

  const quota = await checkSubmissionQuota(user.id, user.role, user.isTrusted);
  if (!quota.ok) {
    return { status: "error", message: `You have used your ${quota.limit} submissions for today. Thanks for the enthusiasm.` };
  }

  const rawUrl = parsed.data.url.trim();
  const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

  try {
    await assertSafeUrl(withProtocol);
  } catch (error) {
    return { status: "error", message: error instanceof UnsafeUrlError ? error.message : "That URL could not be validated." };
  }

  const canonicalUrl = canonicalizeUrl(withProtocol);

  const existing = await queryOne<{ slug: string; title: string }>(sql`
    SELECT slug, title FROM resources WHERE canonical_url = ${canonicalUrl} LIMIT 1
  `);
  if (existing) {
    return { status: "error", message: `Already in the atlas as "${existing.title}".` };
  }

  const pending = await queryOne<{ id: string }>(sql`
    SELECT id FROM submissions
    WHERE canonical_url = ${canonicalUrl} AND status NOT IN ('rejected', 'failed')
    LIMIT 1
  `);
  if (pending) {
    return { status: "error", message: "Someone already submitted this — it is in the review queue." };
  }

  const [submission] = await query<{ id: string }>(sql`
    INSERT INTO submissions (url, canonical_url, note, submitted_by, status)
    VALUES (${withProtocol}, ${canonicalUrl}, ${parsed.data.note ?? null}, ${user.id}, 'submitted')
    RETURNING id
  `);

  await track("resource_submit", { userId: user.id, metadata: { url: canonicalUrl } });

  after(async () => {
    try {
      await processSubmission(submission.id);
    } catch (error) {
      console.error("[pipeline] unhandled failure:", error);
    }
  });

  revalidatePath("/submit");
  revalidatePath("/admin/review");

  return {
    status: "queued",
    submissionId: submission.id,
    message: "Submitted. The pipeline is fetching and analysing it now.",
  };
}

export async function retrySubmissionAction(submissionId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const submission = await queryOne<{ submittedBy: string | null; attempts: number }>(
    sql`SELECT submitted_by AS "submittedBy", attempts FROM submissions WHERE id = ${submissionId}`,
  );
  if (!submission) return { ok: false, error: "Submission not found." };

  const isOwner = submission.submittedBy === user.id;
  const isEditor = user.role === "editor" || user.role === "admin";
  if (!isOwner && !isEditor) return { ok: false, error: "You cannot retry this submission." };
  if (submission.attempts >= 4) return { ok: false, error: "This submission has failed too many times." };

  await execute(sql`UPDATE submissions SET status = 'submitted', error_message = NULL WHERE id = ${submissionId}`);
  after(async () => {
    await processSubmission(submissionId);
  });

  revalidatePath("/submit");
  revalidatePath("/admin/review");
  return { ok: true };
}

export async function approveSubmissionAction(
  submissionId: string,
  overrides: { isEditorPick?: boolean } = {},
): Promise<{ ok: boolean; slug?: string; error?: string }> {
  const editor = await requireRole("editor");
  const result = await publishSubmission(submissionId, editor.id, overrides);

  if ("error" in result) return { ok: false, error: result.error };

  await track("resource_approve", { userId: editor.id, metadata: { submissionId } });
  revalidateReview(result.slug);
  return { ok: true, slug: result.slug };
}

export async function rejectSubmissionAction(submissionId: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const editor = await requireRole("editor");
  if (!reason.trim()) return { ok: false, error: "Give a reason so the contributor can learn from it." };

  await rejectSubmission(submissionId, editor.id, reason.trim().slice(0, 500));
  await track("resource_reject", { userId: editor.id, metadata: { submissionId } });
  revalidateReview();
  return { ok: true };
}

export async function toggleEditorPickAction(resourceId: string): Promise<{ ok: boolean; isPick?: boolean; error?: string }> {
  const editor = await requireRole("editor");

  const existing = await queryOne(sql`SELECT 1 FROM editorial_picks WHERE resource_id = ${resourceId}`);
  if (existing) {
    await execute(sql`DELETE FROM editorial_picks WHERE resource_id = ${resourceId}`);
    await execute(sql`UPDATE resources SET is_editor_pick = false WHERE id = ${resourceId}`);
    revalidateReview();
    return { ok: true, isPick: false };
  }

  await execute(sql`INSERT INTO editorial_picks (resource_id, curator_id) VALUES (${resourceId}, ${editor.id})`);
  await execute(sql`UPDATE resources SET is_editor_pick = true WHERE id = ${resourceId}`);
  revalidateReview();
  return { ok: true, isPick: true };
}

export async function setResourceStatusAction(
  resourceId: string,
  status: "published" | "archived" | "review",
): Promise<{ ok: boolean; error?: string }> {
  await requireRole("editor");
  await execute(sql`UPDATE resources SET status = ${status}::resource_status, updated_at = NOW() WHERE id = ${resourceId}`);
  revalidateReview();
  return { ok: true };
}

function revalidateReview(slug?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/review");
  revalidatePath("/admin/resources");
  revalidatePath("/resources");
  revalidatePath("/");
  if (slug) revalidatePath(`/resources/${slug}`);
}
