import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { contentHash, localEmbedding, resourceEmbeddingInput, toVectorLiteral } from "@/lib/ai/embeddings";
import { getAIProvider } from "@/lib/ai/provider";
import type { ResourceAnalysis } from "@/lib/ai/schema";
import { crawl, CrawlError, type CrawlResult } from "@/lib/crawler/fetch-url";
import { canonicalizeUrl, slugify, UnsafeUrlError } from "@/lib/crawler/url";
import { execute, query, queryOne } from "@/lib/db/query";
import { getTopicSlugs } from "@/lib/queries/topics";

/** Similarity above which two resources are treated as the same thing. */
const DUPLICATE_THRESHOLD = 0.92;
/** Below this the analysis is not trusted enough to auto-clear review. */
const CONFIDENCE_FLOOR = 0.7;

type Stage = "validate_url" | "fetch" | "analyze" | "duplicate_check" | "embed" | "finalize";

export type PipelineOutcome = {
  submissionId: string;
  status: string;
  duplicateOf?: { slug: string; title: string } | null;
  riskLevel: string;
  analysis?: ResourceAnalysis;
  error?: string;
};

/**
 * Runs a submission through the ingestion pipeline.
 *
 * Each stage records an event so a failed run can be inspected and retried
 * without re-reading logs, and the submission's status always reflects the last
 * completed stage. Nothing here talks to the user's request: the caller schedules
 * this after responding, and in production it would be a Trigger.dev task with
 * the same stage boundaries.
 */
export async function processSubmission(submissionId: string): Promise<PipelineOutcome> {
  const submission = await queryOne<{ id: string; url: string; attempts: number }>(
    sql`SELECT id, url, attempts FROM submissions WHERE id = ${submissionId}`,
  );
  if (!submission) return { submissionId, status: "failed", riskLevel: "low", error: "Submission not found." };

  await execute(sql`UPDATE submissions SET attempts = attempts + 1, updated_at = NOW() WHERE id = ${submissionId}`);

  let crawled: CrawlResult;
  try {
    await setStatus(submissionId, "fetching");
    crawled = await runStage(submissionId, "fetch", () => crawl(submission.url));
  } catch (error) {
    return failSubmission(submissionId, error);
  }

  const canonicalUrl = canonicalizeUrl(crawled.canonicalUrl);
  const urlHash = hashUrl(canonicalUrl);

  // Level 1 + 2 of duplicate detection: canonicalisation then hash equality.
  // Cheap, exact, and it runs before any model is invoked.
  const exact = await queryOne<{ slug: string; title: string }>(
    sql`SELECT slug, title FROM resources WHERE url_hash = ${urlHash} LIMIT 1`,
  );
  if (exact) {
    await recordEvent(submissionId, "duplicate_check", "flagged", `Exact URL match with "${exact.title}"`);
    await execute(sql`
      UPDATE submissions SET status = 'rejected', canonical_url = ${canonicalUrl}, url_hash = ${urlHash},
        duplicate_of_id = (SELECT id FROM resources WHERE url_hash = ${urlHash} LIMIT 1),
        duplicate_similarity = 1, risk_level = 'high',
        error_message = 'This URL is already in the atlas.', updated_at = NOW()
      WHERE id = ${submissionId}
    `);
    return { submissionId, status: "rejected", duplicateOf: exact, riskLevel: "high", error: "Already in the atlas." };
  }

  let analysis: ResourceAnalysis;
  let provider: string;
  let model: string;
  try {
    await setStatus(submissionId, "analyzing");
    const topicSlugs = await getTopicSlugs();
    const result = await runStage(submissionId, "analyze", () =>
      getAIProvider().analyzeResource({ crawl: crawled, knownTopicSlugs: topicSlugs }),
    );
    analysis = result.analysis;
    provider = result.provider;
    model = result.model;

    await execute(sql`
      INSERT INTO ai_analyses (submission_id, provider, model, analysis, prompt_tokens, completion_tokens, latency_ms)
      VALUES (${submissionId}, ${provider}, ${model}, ${JSON.stringify(analysis)}::jsonb,
              ${result.promptTokens ?? null}, ${result.completionTokens ?? null}, ${result.latencyMs})
    `);
  } catch (error) {
    return failSubmission(submissionId, error);
  }

  if (analysis.isSpam) {
    await recordEvent(submissionId, "analyze", "flagged", analysis.spamReason ?? "Classified as spam");
    await execute(sql`
      UPDATE submissions SET status = 'rejected', risk_level = 'high',
        error_message = ${analysis.spamReason ?? "Classified as promotional content."},
        canonical_url = ${canonicalUrl}, url_hash = ${urlHash}, updated_at = NOW()
      WHERE id = ${submissionId}
    `);
    return { submissionId, status: "rejected", riskLevel: "high", analysis, error: analysis.spamReason ?? "Spam" };
  }

  // Level 3: semantic near-duplicate detection over the embedding index.
  await setStatus(submissionId, "duplicate_check");
  const embeddingText = resourceEmbeddingInput({
    title: analysis.title,
    description: analysis.description,
    summary: analysis.summary,
    whyItMatters: analysis.whyItMatters,
    whatYouLearn: analysis.whatYouLearn,
    authorName: analysis.authorName,
    organizationName: analysis.organizationName,
    topics: analysis.topics,
  });
  const embedding = (await getAIProvider().embed([embeddingText]))[0] ?? localEmbedding(embeddingText);

  const nearest = await queryOne<{ id: string; slug: string; title: string; similarity: number }>(sql`
    SELECT r.id, r.slug, r.title, (1 - (e.embedding <=> ${toVectorLiteral(embedding)}::vector))::float AS similarity
    FROM resource_embeddings e JOIN resources r ON r.id = e.resource_id
    WHERE r.status <> 'rejected'
    ORDER BY e.embedding <=> ${toVectorLiteral(embedding)}::vector
    LIMIT 1
  `);

  const isNearDuplicate = (nearest?.similarity ?? 0) >= DUPLICATE_THRESHOLD;
  await recordEvent(
    submissionId,
    "duplicate_check",
    isNearDuplicate ? "flagged" : "ok",
    nearest ? `Closest existing resource: "${nearest.title}" at ${(nearest.similarity * 100).toFixed(1)}% similarity` : "No comparable resources",
  );

  // Low-confidence analysis and near-duplicates are the two cases a human must
  // look at; everything else still gets reviewed, just without a warning banner.
  const riskLevel = isNearDuplicate || analysis.confidence < CONFIDENCE_FLOOR ? "high" : "low";

  const draft = {
    ...analysis,
    url: crawled.url,
    canonicalUrl,
    thumbnailUrl: crawled.thumbnailUrl,
    publishedAt: crawled.publishedAt?.toISOString() ?? null,
    metadata: crawled.metadata,
    embedding,
    embeddingModel: getAIProvider().name === "openai" ? "openai" : "local-hash-v1",
    contentHash: contentHash(embeddingText),
  };

  await execute(sql`
    UPDATE submissions SET
      status = 'ready_for_review',
      canonical_url = ${canonicalUrl},
      url_hash = ${urlHash},
      draft = ${JSON.stringify(draft)}::jsonb,
      duplicate_of_id = ${isNearDuplicate ? (nearest?.id ?? null) : null},
      duplicate_similarity = ${nearest?.similarity ?? null},
      risk_level = ${riskLevel},
      error_message = NULL,
      updated_at = NOW()
    WHERE id = ${submissionId}
  `);
  await recordEvent(submissionId, "finalize", "ok", "Queued for editorial review");

  return {
    submissionId,
    status: "ready_for_review",
    duplicateOf: isNearDuplicate ? { slug: nearest!.slug, title: nearest!.title } : null,
    riskLevel,
    analysis,
  };
}

/** Promotes an approved submission into a published resource. */
export async function publishSubmission(
  submissionId: string,
  editorId: string,
  overrides: Partial<{ title: string; description: string; difficulty: string; topics: string[]; isEditorPick: boolean }> = {},
): Promise<{ slug: string } | { error: string }> {
  const submission = await queryOne<{ id: string; url: string; draft: Record<string, unknown> | null; submittedBy: string | null }>(
    sql`SELECT id, url, draft, submitted_by AS "submittedBy" FROM submissions WHERE id = ${submissionId}`,
  );
  if (!submission?.draft) return { error: "This submission has not been analysed yet." };

  const draft = submission.draft as unknown as ResourceAnalysis & {
    url: string;
    canonicalUrl: string;
    thumbnailUrl: string | null;
    publishedAt: string | null;
    metadata: Record<string, unknown>;
    embedding: number[];
    embeddingModel: string;
    contentHash: string;
  };

  const typeRow = await queryOne<{ id: string }>(sql`SELECT id FROM resource_types WHERE slug = ${draft.type}`);
  if (!typeRow) return { error: `Unknown resource type "${draft.type}".` };

  const title = overrides.title ?? draft.title;
  const slug = await uniqueSlug(slugify(title));
  const topics = overrides.topics ?? draft.topics;

  const [resource] = await query<{ id: string; slug: string }>(sql`
    INSERT INTO resources (
      slug, title, url, canonical_url, url_hash, description, summary, why_it_matters,
      key_takeaways, what_you_learn, prerequisites, best_for,
      resource_type_id, difficulty, language, price_model, estimated_minutes,
      author_name, organization_name, is_official, has_code, thumbnail_url, metadata,
      published_at, last_checked_at, status, visibility,
      quality_score, is_editor_pick, created_by
    ) VALUES (
      ${slug}, ${title}, ${draft.url}, ${draft.canonicalUrl}, ${hashUrl(draft.canonicalUrl)},
      ${overrides.description ?? draft.description}, ${draft.summary ?? null}, ${draft.whyItMatters ?? null},
      ${draft.keyTakeaways ?? []}, ${draft.whatYouLearn ?? []}, ${draft.prerequisites ?? []}, ${draft.bestFor ?? []},
      ${typeRow.id}, ${overrides.difficulty ?? draft.difficulty}, ${draft.language}, ${draft.priceModel},
      ${draft.estimatedMinutes ?? null}, ${draft.authorName ?? null}, ${draft.organizationName ?? null},
      ${draft.isOfficial}, ${draft.hasCode}, ${draft.thumbnailUrl ?? null}, ${JSON.stringify(draft.metadata ?? {})}::jsonb,
      ${draft.publishedAt ?? null}, NOW(), 'published', 'public',
      ${draft.qualityScore}, ${overrides.isEditorPick ?? false}, ${submission.submittedBy}
    )
    RETURNING id, slug
  `);

  for (const [position, topicSlug] of topics.entries()) {
    await execute(sql`
      INSERT INTO resource_topics (resource_id, topic_id, is_primary, relevance)
      SELECT ${resource.id}, id, ${position === 0}, ${Math.max(0.4, 1 - position * 0.15)}
      FROM topics WHERE slug = ${topicSlug}
      ON CONFLICT DO NOTHING
    `);
  }

  if (Array.isArray(draft.embedding) && draft.embedding.length > 0) {
    await execute(sql`
      INSERT INTO resource_embeddings (resource_id, embedding, model, content_hash)
      VALUES (${resource.id}, ${toVectorLiteral(draft.embedding)}::vector, ${draft.embeddingModel}, ${draft.contentHash})
      ON CONFLICT (resource_id) DO UPDATE SET embedding = EXCLUDED.embedding
    `);
  }

  if (overrides.isEditorPick) {
    await execute(sql`
      INSERT INTO editorial_picks (resource_id, curator_id) VALUES (${resource.id}, ${editorId})
      ON CONFLICT (resource_id) DO NOTHING
    `);
  }

  await execute(sql`
    UPDATE submissions SET status = 'published', resource_id = ${resource.id}, updated_at = NOW() WHERE id = ${submissionId}
  `);
  await execute(sql`
    INSERT INTO submission_reviews (submission_id, reviewer_id, decision, note)
    VALUES (${submissionId}, ${editorId}, 'approved', 'Published to the catalogue')
  `);
  await execute(sql`
    UPDATE ai_analyses SET resource_id = ${resource.id} WHERE submission_id = ${submissionId}
  `);

  return { slug: resource.slug };
}

export async function rejectSubmission(submissionId: string, editorId: string, reason: string): Promise<void> {
  await execute(sql`
    UPDATE submissions SET status = 'rejected', error_message = ${reason}, updated_at = NOW() WHERE id = ${submissionId}
  `);
  await execute(sql`
    INSERT INTO submission_reviews (submission_id, reviewer_id, decision, note)
    VALUES (${submissionId}, ${editorId}, 'rejected', ${reason})
  `);
}

/* ── stage plumbing ───────────────────────────────────────────────────────── */

async function runStage<T>(submissionId: string, stage: Stage, work: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await work();
    await recordEvent(submissionId, stage, "ok", null, Date.now() - startedAt);
    return result;
  } catch (error) {
    await recordEvent(submissionId, stage, "error", describeError(error), Date.now() - startedAt);
    throw error;
  }
}

async function recordEvent(
  submissionId: string,
  stage: string,
  status: string,
  message: string | null,
  durationMs?: number,
): Promise<void> {
  await execute(sql`
    INSERT INTO submission_events (submission_id, stage, status, message, duration_ms)
    VALUES (${submissionId}, ${stage}, ${status}, ${message}, ${durationMs ?? null})
  `);
}

async function setStatus(submissionId: string, status: string): Promise<void> {
  await execute(sql`UPDATE submissions SET status = ${status}::submission_status, updated_at = NOW() WHERE id = ${submissionId}`);
}

async function failSubmission(submissionId: string, error: unknown): Promise<PipelineOutcome> {
  const message = describeError(error);
  const retryable = error instanceof CrawlError ? error.retryable : false;
  await execute(sql`
    UPDATE submissions SET status = 'failed', error_message = ${message}, updated_at = NOW() WHERE id = ${submissionId}
  `);
  return { submissionId, status: "failed", riskLevel: "low", error: retryable ? `${message} You can retry this.` : message };
}

function describeError(error: unknown): string {
  if (error instanceof UnsafeUrlError || error instanceof CrawlError) return error.message;
  if (error instanceof Error) return error.message.slice(0, 300);
  return "Unexpected pipeline error.";
}

function hashUrl(canonicalUrl: string): string {
  return createHash("sha256").update(canonicalUrl).digest("hex");
}

async function uniqueSlug(base: string): Promise<string> {
  for (let suffix = 0; suffix < 50; suffix++) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const clash = await queryOne(sql`SELECT 1 FROM resources WHERE slug = ${candidate}`);
    if (!clash) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
