import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { contentHash, localEmbedding, resourceEmbeddingInput } from "../ai/embeddings.ts";
import { hashPassword } from "../auth/password.ts";
import { canonicalizeUrl } from "../crawler/url.ts";
import { computeTrendingScore } from "../ranking/trending.ts";
import * as schema from "./schema.ts";
import { seedResourceTypes, seedTopics, seedUsers } from "./seed-taxonomy.ts";
import { seedPaths, seedRelations, seedResources, seedReviews } from "./seed-content.ts";
import { createHash } from "node:crypto";

const DAYS_OF_HISTORY = 60;

async function main() {
  const db = await connect();

  console.log("▸ clearing existing data");
  // Ordered by dependency; `resources` cascades to topics, embeddings and stats.
  await db.execute(sql`
    TRUNCATE TABLE
      resource_events, search_queries, resource_daily_stats, topic_daily_stats,
      submission_events, submission_reviews, ai_analyses, submissions, reports,
      editorial_picks, reviews, bookmarks, path_enrollments,
      learning_path_resources, learning_path_stages, learning_paths,
      resource_relations, resource_embeddings, resource_topics, resources,
      related_topics, topics, resource_types, sessions, profiles
    RESTART IDENTITY CASCADE
  `);

  /* ── Taxonomy ──────────────────────────────────────────────────────────── */

  const typeIds = new Map<string, string>();
  for (const [index, type] of seedResourceTypes.entries()) {
    const [row] = await db
      .insert(schema.resourceTypes)
      .values({ ...type, sortOrder: index, isPrimaryNav: type.isPrimaryNav ?? false })
      .returning({ id: schema.resourceTypes.id });
    typeIds.set(type.slug, row.id);
  }
  console.log(`▸ ${typeIds.size} resource types`);

  const topicIds = new Map<string, string>();
  // Parents first so child rows can resolve `parentId` in a single pass each.
  for (const group of [seedTopics.filter((t) => !t.parent), seedTopics.filter((t) => t.parent)]) {
    for (const [index, topic] of group.entries()) {
      const [row] = await db
        .insert(schema.topics)
        .values({
          slug: topic.slug,
          name: topic.name,
          shortName: topic.shortName,
          tagline: topic.tagline,
          description: topic.description,
          parentId: topic.parent ? topicIds.get(topic.parent) : null,
          icon: topic.icon,
          accent: topic.accent,
          isFeatured: topic.isFeatured ?? false,
          sortOrder: index,
        })
        .returning({ id: schema.topics.id });
      topicIds.set(topic.slug, row.id);
    }
  }
  for (const topic of seedTopics) {
    for (const related of topic.related ?? []) {
      const [a, b] = [topicIds.get(topic.slug), topicIds.get(related)];
      if (a && b) await db.insert(schema.relatedTopics).values({ topicId: a, relatedTopicId: b }).onConflictDoNothing();
    }
  }
  console.log(`▸ ${topicIds.size} topics`);

  /* ── People ────────────────────────────────────────────────────────────── */

  const userIds = new Map<string, string>();
  for (const user of seedUsers) {
    const [row] = await db
      .insert(schema.profiles)
      .values({
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        passwordHash: await hashPassword(user.password),
        role: user.role,
        headline: user.headline,
        bio: user.bio,
        isTrusted: user.isTrusted ?? false,
        avatarUrl: gravatar(user.email),
      })
      .returning({ id: schema.profiles.id });
    userIds.set(user.username, row.id);
  }
  console.log(`▸ ${userIds.size} profiles`);

  /* ── Resources ─────────────────────────────────────────────────────────── */

  const resourceIds = new Map<string, string>();
  const curators = ["sierra", "mira", "devan", "lena"];

  for (const [index, resource] of seedResources.entries()) {
    const typeId = typeIds.get(resource.type);
    if (!typeId) throw new Error(`Unknown resource type "${resource.type}" on ${resource.slug}`);

    const canonicalUrl = canonicalizeUrl(resource.url);
    const [row] = await db
      .insert(schema.resources)
      .values({
        slug: resource.slug,
        title: resource.title,
        url: resource.url,
        canonicalUrl,
        urlHash: createHash("sha256").update(canonicalUrl).digest("hex"),
        description: resource.description,
        summary: resource.summary,
        whyItMatters: resource.whyItMatters,
        keyTakeaways: resource.keyTakeaways,
        whatYouLearn: resource.whatYouLearn,
        prerequisites: resource.prerequisites,
        bestFor: resource.bestFor,
        resourceTypeId: typeId,
        difficulty: resource.difficulty,
        language: resource.language ?? "en",
        priceModel: resource.priceModel ?? "free",
        estimatedMinutes: resource.estimatedMinutes,
        authorName: resource.authorName,
        organizationName: resource.organizationName,
        isOfficial: resource.isOfficial ?? false,
        hasCode: resource.hasCode ?? resource.type === "github",
        metadata: (resource.metadata ?? {}) as schema.ResourceMetadata,
        publishedAt: resource.publishedAt ? new Date(resource.publishedAt) : null,
        lastCheckedAt: new Date(),
        status: "published",
        visibility: "public",
        qualityScore: String(resource.qualityScore),
        editorScore: resource.editorScore != null ? String(resource.editorScore) : null,
        communityScore: resource.communityScore != null ? String(resource.communityScore) : null,
        isEditorPick: resource.isEditorPick ?? false,
        viewsCount: resource.views,
        savesCount: resource.saves,
        clicksCount: resource.clicks ?? Math.round(resource.views * 0.35),
        completionsCount: resource.completions ?? Math.round(resource.saves * 0.18),
        ratingsCount: resource.ratingsCount ?? 0,
        createdBy: userIds.get(curators[index % curators.length]),
      })
      .returning({ id: schema.resources.id });
    resourceIds.set(resource.slug, row.id);

    const topics = resource.topics.filter((slug) => topicIds.has(slug));
    if (topics.length !== resource.topics.length) {
      const unknown = resource.topics.filter((slug) => !topicIds.has(slug));
      console.warn(`  ! ${resource.slug}: dropped unknown topics ${unknown.join(", ")}`);
    }
    for (const [position, slug] of topics.entries()) {
      await db.insert(schema.resourceTopics).values({
        resourceId: row.id,
        topicId: topicIds.get(slug)!,
        isPrimary: position === 0,
        relevance: Math.max(0.4, 1 - position * 0.15),
      });
    }

    const embeddingText = resourceEmbeddingInput({
      title: resource.title,
      description: resource.description,
      summary: resource.summary,
      whyItMatters: resource.whyItMatters,
      whatYouLearn: resource.whatYouLearn,
      authorName: resource.authorName,
      organizationName: resource.organizationName,
      topics: topics.map((slug) => seedTopics.find((t) => t.slug === slug)?.name ?? slug),
    });
    await db.insert(schema.resourceEmbeddings).values({
      resourceId: row.id,
      embedding: localEmbedding(embeddingText),
      model: "local-hash-v1",
      contentHash: contentHash(embeddingText),
    });

    if (resource.isEditorPick) {
      await db.insert(schema.editorialPicks).values({
        resourceId: row.id,
        curatorId: userIds.get("mira"),
        note: resource.editorNote,
        rank: index,
      });
    }
  }
  console.log(`▸ ${resourceIds.size} resources (+ topics, embeddings)`);

  /* ── Knowledge graph ───────────────────────────────────────────────────── */

  let edges = 0;
  for (const relation of seedRelations) {
    const from = resourceIds.get(relation.from);
    const to = resourceIds.get(relation.to);
    if (!from || !to) {
      console.warn(`  ! relation skipped: ${relation.from} → ${relation.to}`);
      continue;
    }
    await db
      .insert(schema.resourceRelations)
      .values({ fromResourceId: from, toResourceId: to, relation: relation.relation, weight: relation.weight ?? 1 })
      .onConflictDoNothing();
    edges++;
  }
  console.log(`▸ ${edges} knowledge-graph edges`);

  /* ── Learning paths ────────────────────────────────────────────────────── */

  const pathIds = new Map<string, string>();
  let stageCount = 0;
  for (const [index, path] of seedPaths.entries()) {
    const [pathRow] = await db
      .insert(schema.learningPaths)
      .values({
        slug: path.slug,
        title: path.title,
        subtitle: path.subtitle,
        description: path.description,
        audience: path.audience,
        outcomes: path.outcomes,
        difficulty: path.difficulty,
        estimatedWeeks: path.estimatedWeeks,
        icon: path.icon,
        accent: path.accent,
        category: path.category,
        isPopular: path.isPopular ?? false,
        learnersCount: path.learnersCount,
        sortOrder: index,
      })
      .returning({ id: schema.learningPaths.id });
    pathIds.set(path.slug, pathRow.id);

    for (const [position, stage] of path.stages.entries()) {
      const [stageRow] = await db
        .insert(schema.learningPathStages)
        .values({
          pathId: pathRow.id,
          position,
          title: stage.title,
          description: stage.description,
          estimatedWeeks: stage.estimatedWeeks,
        })
        .returning({ id: schema.learningPathStages.id });
      stageCount++;

      for (const [resourcePosition, slug] of stage.resources.entries()) {
        const resourceId = resourceIds.get(slug);
        if (!resourceId) {
          console.warn(`  ! ${path.slug}/${stage.title}: unknown resource ${slug}`);
          continue;
        }
        await db
          .insert(schema.learningPathResources)
          .values({ stageId: stageRow.id, resourceId, position: resourcePosition })
          .onConflictDoNothing();
      }
    }
  }
  console.log(`▸ ${pathIds.size} learning paths, ${stageCount} stages`);

  /* ── Community signal ──────────────────────────────────────────────────── */

  let reviewCount = 0;
  for (const review of seedReviews) {
    const resourceId = resourceIds.get(review.resource);
    const userId = userIds.get(review.user);
    if (!resourceId || !userId) continue;
    await db
      .insert(schema.reviews)
      .values({ resourceId, userId, rating: review.rating, body: review.body, helpfulCount: Math.floor(Math.random() * 40) })
      .onConflictDoNothing();
    reviewCount++;
  }
  // Ratings shown in the UI are derived, never hand-written.
  await db.execute(sql`
    UPDATE resources r SET
      community_score = agg.avg_rating,
      ratings_count = GREATEST(r.ratings_count, agg.count)
    FROM (SELECT resource_id, ROUND(AVG(rating)::numeric, 2) avg_rating, COUNT(*) count FROM reviews GROUP BY resource_id) agg
    WHERE r.id = agg.resource_id
  `);
  console.log(`▸ ${reviewCount} reviews`);

  await seedUserActivity(db, resourceIds, userIds, pathIds);
  await seedDailyStats(db, resourceIds, topicIds);
  await seedSubmissionQueue(db, typeIds, userIds, resourceIds);
  await seedSearchLog(db, userIds, resourceIds);
  await recomputeTrending(db);

  const [{ count }] = await db.execute<{ count: number }>(sql`SELECT COUNT(*)::int count FROM resources WHERE status = 'published'`).then((r) => r.rows ?? r) as unknown as Array<{ count: number }>;
  console.log(`\n✓ seed complete — ${count} published resources`);
  process.exit(0);
}

/** Gives the demo accounts a believable library, so signed-in views are not empty. */
async function seedUserActivity(
  db: Awaited<ReturnType<typeof connect>>,
  resourceIds: Map<string, string>,
  userIds: Map<string, string>,
  pathIds: Map<string, string>,
) {
  const slugs = [...resourceIds.keys()];
  const plans: Array<[string, number, schema.LearningState]> = [
    ["kai", 0, "completed"],
    ["kai", 1, "in_progress"],
    ["kai", 2, "saved"],
    ["sierra", 0, "in_progress"],
    ["sierra", 1, "saved"],
    ["devan", 2, "completed"],
    ["lena", 1, "saved"],
    ["mira", 0, "completed"],
  ];

  let bookmarks = 0;
  for (const [username, offset, state] of plans) {
    const userId = userIds.get(username);
    if (!userId) continue;
    // Deterministic spread across the catalogue rather than a random sample.
    for (let i = offset; i < slugs.length; i += 5) {
      const resourceId = resourceIds.get(slugs[i]);
      if (!resourceId) continue;
      await db
        .insert(schema.bookmarks)
        .values({
          userId,
          resourceId,
          state,
          completedAt: state === "completed" ? daysAgo(Math.floor(Math.random() * 40)) : null,
          createdAt: daysAgo(Math.floor(Math.random() * 60) + 1),
        })
        .onConflictDoNothing();
      bookmarks++;
    }
  }

  for (const [username, pathSlug] of [
    ["kai", "llm-engineer"],
    ["sierra", "ai-engineering-bootcamp"],
    ["devan", "rag-in-production"],
    ["lena", "ai-agents-from-scratch"],
  ] as const) {
    const userId = userIds.get(username);
    const pathId = pathIds.get(pathSlug);
    if (userId && pathId) {
      await db
        .insert(schema.pathEnrollments)
        .values({ userId, pathId, startedAt: daysAgo(30) })
        .onConflictDoNothing();
    }
  }
  console.log(`▸ ${bookmarks} bookmarks + path enrollments`);
}

/**
 * Synthesises 60 days of daily rollups. Each resource follows its own momentum
 * curve so the trending algorithm has real acceleration to detect and the
 * attention heatmap has genuine texture instead of noise.
 */
async function seedDailyStats(
  db: Awaited<ReturnType<typeof connect>>,
  resourceIds: Map<string, string>,
  topicIds: Map<string, string>,
) {
  const resourceRows: Array<typeof schema.resourceDailyStats.$inferInsert> = [];

  for (const resource of seedResources) {
    const id = resourceIds.get(resource.slug);
    if (!id) continue;
    const momentum = resource.momentum ?? 0.4;
    const dailyBase = Math.max(1, resource.views / 400);
    const seed = hashToUnit(resource.slug);

    for (let dayOffset = DAYS_OF_HISTORY - 1; dayOffset >= 0; dayOffset--) {
      const progress = (DAYS_OF_HISTORY - dayOffset) / DAYS_OF_HISTORY;
      // Momentum bends the curve upward over the window; low momentum decays.
      const trend = 1 + (momentum - 0.35) * 2.2 * progress;
      const weekly = 1 + 0.18 * Math.sin((dayOffset / 7) * Math.PI * 2);
      const jitter = 0.75 + 0.5 * pseudoRandom(seed + dayOffset);
      const views = Math.max(0, Math.round(dailyBase * trend * weekly * jitter));

      resourceRows.push({
        resourceId: id,
        day: isoDay(dayOffset),
        views,
        clicks: Math.round(views * (0.28 + 0.2 * pseudoRandom(seed + dayOffset + 100))),
        saves: Math.round(views * (0.03 + 0.06 * momentum)),
        completions: Math.round(views * 0.012 * momentum),
      });
    }
  }
  await insertInChunks(db, schema.resourceDailyStats, resourceRows);

  // Topic-level attention drives the trending heatmap.
  const topicRows: Array<typeof schema.topicDailyStats.$inferInsert> = [];
  const topicMomentum = new Map<string, number>();
  for (const resource of seedResources) {
    for (const [position, slug] of resource.topics.entries()) {
      const weight = 1 - position * 0.2;
      topicMomentum.set(slug, (topicMomentum.get(slug) ?? 0) + (resource.momentum ?? 0.4) * weight);
    }
  }
  const peak = Math.max(1, ...topicMomentum.values());

  for (const [slug, raw] of topicMomentum) {
    const id = topicIds.get(slug);
    if (!id) continue;
    const strength = raw / peak;
    const seed = hashToUnit(slug);
    for (let dayOffset = DAYS_OF_HISTORY - 1; dayOffset >= 0; dayOffset--) {
      const progress = (DAYS_OF_HISTORY - dayOffset) / DAYS_OF_HISTORY;
      const attention = Math.max(
        0,
        strength * (0.5 + 0.8 * progress) * (0.65 + 0.7 * pseudoRandom(seed + dayOffset * 3)),
      );
      topicRows.push({
        topicId: id,
        day: isoDay(dayOffset),
        views: Math.round(attention * 900),
        searches: Math.round(attention * 120),
        attention: Math.round(attention * 1000) / 1000,
      });
    }
  }
  await insertInChunks(db, schema.topicDailyStats, topicRows);
  console.log(`▸ ${resourceRows.length + topicRows.length} daily stat rows (${DAYS_OF_HISTORY} days)`);
}

/** A review queue with something in every state, so /admin is not an empty page. */
async function seedSubmissionQueue(
  db: Awaited<ReturnType<typeof connect>>,
  _typeIds: Map<string, string>,
  userIds: Map<string, string>,
  resourceIds: Map<string, string>,
) {
  const queue: Array<{
    url: string;
    title: string;
    status: schema.Submission["status"];
    by: string;
    risk?: string;
    duplicateOf?: string;
    similarity?: number;
    note?: string;
    error?: string;
  }> = [
    {
      url: "https://arxiv.org/abs/2402.03300",
      title: "DeepSeekMath: Pushing the Limits of Mathematical Reasoning",
      status: "ready_for_review",
      by: "devan",
      note: "Introduces GRPO, which everything else is now citing.",
    },
    {
      url: "https://www.anthropic.com/engineering/building-effective-agents",
      title: "Building Effective Agents",
      status: "ready_for_review",
      by: "lena",
      note: "Best short piece on when NOT to build an agent.",
    },
    {
      url: "https://github.com/pytorch/torchtune",
      title: "torchtune: PyTorch native post-training library",
      status: "ready_for_review",
      by: "kai",
    },
    {
      url: "https://arxiv.org/abs/1706.03762v7",
      title: "Attention Is All You Need",
      status: "ready_for_review",
      by: "kai",
      risk: "high",
      duplicateOf: "attention-is-all-you-need",
      similarity: 0.98,
      note: "Found this while reading about transformers.",
    },
    { url: "https://huggingface.co/blog/mcp", title: "Model Context Protocol on the Hub", status: "analyzing", by: "devan" },
    { url: "https://modal.com/gpu-glossary", title: "GPU Glossary", status: "fetching", by: "sierra" },
    { url: "https://example.com/best-ai-tools-2026-affiliate", title: "Top 50 AI Tools (sponsored)", status: "rejected", by: "kai", risk: "high" },
    { url: "https://private-notion-page.example.com/x", title: "", status: "failed", by: "kai", error: "Upstream returned 403." },
    { url: "https://lilianweng.github.io/posts/2024-11-28-reward-hacking/", title: "Reward Hacking in RL", status: "published", by: "lena" },
  ];

  for (const item of queue) {
    const canonicalUrl = canonicalizeUrl(item.url);
    const [submission] = await db
      .insert(schema.submissions)
      .values({
        url: item.url,
        canonicalUrl,
        urlHash: createHash("sha256").update(canonicalUrl).digest("hex"),
        note: item.note,
        submittedBy: userIds.get(item.by),
        status: item.status,
        draft: item.title ? { title: item.title, description: `Pending analysis of ${item.title}.` } : null,
        duplicateOfId: item.duplicateOf ? resourceIds.get(item.duplicateOf) : null,
        duplicateSimilarity: item.similarity,
        riskLevel: item.risk ?? "low",
        errorMessage: item.error,
        createdAt: daysAgo(Math.floor(Math.random() * 9)),
      })
      .returning({ id: schema.submissions.id });

    const timeline: Array<[string, string, string | null]> = [
      ["validate_url", "ok", "Passed SSRF and reputation checks"],
      ["fetch", item.status === "failed" ? "error" : "ok", item.error ?? "Fetched document"],
      ["analyze", ["submitted", "fetching", "failed"].includes(item.status) ? "skipped" : "ok", "Structured analysis validated against schema"],
      [
        "duplicate_check",
        item.duplicateOf ? "flagged" : ["submitted", "fetching", "analyzing", "failed"].includes(item.status) ? "skipped" : "ok",
        item.duplicateOf ? `Similarity ${item.similarity} against an existing resource` : "No near-duplicates found",
      ],
    ];
    for (const [stage, status, message] of timeline) {
      await db.insert(schema.submissionEvents).values({ submissionId: submission.id, stage, status, message, durationMs: 40 + Math.floor(Math.random() * 900) });
    }
  }
  console.log(`▸ ${queue.length} submissions in the pipeline`);
}

/** Search demand is the topic backlog; the admin dashboard reads this table. */
async function seedSearchLog(
  db: Awaited<ReturnType<typeof connect>>,
  userIds: Map<string, string>,
  resourceIds: Map<string, string>,
) {
  const queries: Array<[string, number, number]> = [
    ["agent memory", 184, 2],
    ["llm inference optimization", 156, 14],
    ["rag evaluation", 141, 9],
    ["mcp servers", 132, 4],
    ["kv cache", 118, 7],
    ["fine-tuning vs rag", 97, 11],
    ["speculative decoding", 88, 3],
    ["ai coding agents", 84, 12],
    ["long context benchmarks", 71, 5],
    ["prompt caching", 64, 1],
    ["moe routing", 58, 6],
    ["vllm vs tgi", 52, 8],
  ];
  const slugs = [...resourceIds.keys()];
  const users = [...userIds.values()];
  const rows: Array<typeof schema.searchQueries.$inferInsert> = [];

  for (const [query, volume, results] of queries) {
    // Compress the long tail: enough rows to rank, not 184 inserts per query.
    const samples = Math.max(3, Math.round(volume / 12));
    for (let i = 0; i < samples; i++) {
      rows.push({
        query,
        normalizedQuery: query.toLowerCase(),
        userId: i % 3 === 0 ? users[i % users.length] : null,
        resultsCount: results,
        clickedResourceId: results > 0 && i % 2 === 0 ? resourceIds.get(slugs[i % slugs.length]) : null,
        mode: "hybrid",
        durationMs: 40 + Math.floor(Math.random() * 260),
        createdAt: daysAgo(Math.floor(Math.random() * 30)),
      });
    }
  }
  await insertInChunks(db, schema.searchQueries, rows);
  console.log(`▸ ${rows.length} logged searches`);
}

/** Recomputes `trending_score` from the daily rollups, exactly as the cron job does. */
async function recomputeTrending(db: Awaited<ReturnType<typeof connect>>) {
  const { rows } = await db.execute<{
    id: string;
    quality_score: string;
    editor_score: string | null;
    published_at: string | null;
    recent_views: number;
    recent_saves: number;
    recent_clicks: number;
    recent_completions: number;
    prior_views: number;
    prior_saves: number;
  }>(sql`
    SELECT r.id, r.quality_score, r.editor_score, r.published_at,
      COALESCE(SUM(CASE WHEN s.day > CURRENT_DATE - 7 THEN s.views END), 0)::int recent_views,
      COALESCE(SUM(CASE WHEN s.day > CURRENT_DATE - 7 THEN s.saves END), 0)::int recent_saves,
      COALESCE(SUM(CASE WHEN s.day > CURRENT_DATE - 7 THEN s.clicks END), 0)::int recent_clicks,
      COALESCE(SUM(CASE WHEN s.day > CURRENT_DATE - 7 THEN s.completions END), 0)::int recent_completions,
      COALESCE(SUM(CASE WHEN s.day <= CURRENT_DATE - 7 AND s.day > CURRENT_DATE - 14 THEN s.views END), 0)::int prior_views,
      COALESCE(SUM(CASE WHEN s.day <= CURRENT_DATE - 7 AND s.day > CURRENT_DATE - 14 THEN s.saves END), 0)::int prior_saves
    FROM resources r
    LEFT JOIN resource_daily_stats s ON s.resource_id = r.id
    GROUP BY r.id
  `);

  for (const row of rows) {
    const { score } = computeTrendingScore({
      recentViews: row.recent_views,
      recentSaves: row.recent_saves,
      recentClicks: row.recent_clicks,
      recentCompletions: row.recent_completions,
      priorViews: row.prior_views,
      priorSaves: row.prior_saves,
      qualityScore: Number(row.quality_score),
      editorScore: row.editor_score != null ? Number(row.editor_score) : null,
      publishedAt: row.published_at ? new Date(row.published_at) : null,
    });
    await db.execute(sql`UPDATE resources SET trending_score = ${score} WHERE id = ${row.id}`);
  }
  console.log(`▸ trending scores recomputed for ${rows.length} resources`);
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

async function insertInChunks<T extends { $inferInsert: object }>(
  db: Awaited<ReturnType<typeof connect>>,
  table: T,
  rows: Array<T["$inferInsert"]>,
  size = 500,
) {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    if (chunk.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.insert(table as any).values(chunk as any).onConflictDoNothing();
    }
  }
}

function isoDay(daysBack: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysBack);
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

function hashToUnit(input: string): number {
  return createHash("sha1").update(input).digest().readUInt16BE(0);
}

/** Deterministic pseudo-randomness keeps reseeding reproducible. */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function gravatar(email: string): string {
  const hash = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=160`;
}

async function connect() {
  if (process.env.DATABASE_URL) {
    const { default: postgres } = await import("postgres");
    const { drizzle: drizzlePostgres } = await import("drizzle-orm/postgres-js");
    return drizzlePostgres(postgres(process.env.DATABASE_URL, { max: 1 }), { schema }) as unknown as ReturnType<typeof drizzle<typeof schema>>;
  }
  const { createEmbeddedPglite } = await import("./pglite.ts");
  const client = await createEmbeddedPglite();
  return drizzle(client, { schema });
}

main().catch((error) => {
  console.error("\n✗ seed failed:", error);
  process.exit(1);
});
