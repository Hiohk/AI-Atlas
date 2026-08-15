import { sql } from "drizzle-orm";
import { getAIProvider } from "@/lib/ai/provider";
import { toVectorLiteral } from "@/lib/ai/embeddings";
import { oneOf, query } from "@/lib/db/query";
import type { ResourceListItem } from "@/lib/queries/types";

export type SearchMode = "keyword" | "semantic" | "hybrid";

export type SearchHit = ResourceListItem & {
  keywordScore: number;
  semanticScore: number;
  finalScore: number;
  highlight: string | null;
};

export type SearchResponse = {
  hits: SearchHit[];
  total: number;
  mode: SearchMode;
  durationMs: number;
  /** Topics whose name matches the query — surfaced above the results. */
  topicMatches: Array<{ slug: string; name: string; accent: string; icon: string; resourceCount: number }>;
  didYouMean: string | null;
};

/**
 * Reciprocal rank fusion. Combines rankings without needing the two scoring
 * scales to be comparable, which is exactly the problem with mixing ts_rank
 * against cosine distance.
 */
const RRF_K = 60;

const SCORE_WEIGHTS = {
  semantic: 0.35,
  keyword: 0.25,
  quality: 0.15,
  popularity: 0.1,
  freshness: 0.1,
  editorial: 0.05,
} as const;

export async function search(
  rawQuery: string,
  {
    mode = "hybrid",
    limit = 20,
    offset = 0,
    filters = {},
    userId = null,
  }: {
    mode?: SearchMode;
    limit?: number;
    offset?: number;
    filters?: { types?: string[]; difficulties?: string[]; topic?: string };
    userId?: string | null;
  } = {},
): Promise<SearchResponse> {
  const startedAt = Date.now();
  const text = rawQuery.trim();
  if (!text) {
    return { hits: [], total: 0, mode, durationMs: 0, topicMatches: [], didYouMean: null };
  }

  const conditions = [sql`r.status = 'published'`, sql`r.visibility = 'public'`];
  if (filters.types?.length) conditions.push(oneOf(sql`rt.slug`, filters.types));
  if (filters.difficulties?.length) conditions.push(oneOf(sql`r.difficulty::text`, filters.difficulties));
  if (filters.topic) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM resource_topics xt WHERE xt.resource_id = r.id AND xt.topic_id IN (
        WITH RECURSIVE subtree AS (
          SELECT id FROM topics WHERE slug = ${filters.topic}
          UNION ALL SELECT c.id FROM topics c JOIN subtree s ON c.parent_id = s.id
        ) SELECT id FROM subtree
      )
    )`);
  }
  const where = sql.join(conditions, sql` AND `);

  // Fetch a deeper candidate pool than requested so fusion has room to reorder.
  const poolSize = Math.min(240, (limit + offset) * 4 + 40);
  const wantsKeyword = mode !== "semantic";
  const wantsSemantic = mode !== "keyword";

  const provider = getAIProvider();
  const embedding = wantsSemantic ? (await provider.embed([text]))[0] : null;

  const [keywordRows, semanticRows, topicMatches] = await Promise.all([
    wantsKeyword ? keywordSearch(text, where, poolSize) : Promise.resolve([]),
    embedding ? semanticSearch(embedding, where, poolSize, provider.similarityFloor) : Promise.resolve([]),
    matchTopics(text),
  ]);

  const fused = new Map<string, { keywordScore: number; semanticScore: number; rrf: number; highlight: string | null }>();

  keywordRows.forEach((row, index) => {
    const entry = fused.get(row.id) ?? { keywordScore: 0, semanticScore: 0, rrf: 0, highlight: null };
    entry.keywordScore = row.score;
    entry.highlight = row.highlight;
    entry.rrf += SCORE_WEIGHTS.keyword * (1 / (RRF_K + index + 1));
    fused.set(row.id, entry);
  });
  semanticRows.forEach((row, index) => {
    const entry = fused.get(row.id) ?? { keywordScore: 0, semanticScore: 0, rrf: 0, highlight: null };
    entry.semanticScore = row.score;
    entry.rrf += SCORE_WEIGHTS.semantic * (1 / (RRF_K + index + 1));
    fused.set(row.id, entry);
  });

  if (fused.size === 0) {
    return {
      hits: [],
      total: 0,
      mode,
      durationMs: Date.now() - startedAt,
      topicMatches,
      didYouMean: await suggestAlternative(text),
    };
  }

  const ids = [...fused.keys()];
  const cards = await loadCards(ids, userId);

  const hits = cards
    .map((card) => {
      const parts = fused.get(card.id)!;
      // Rank fusion decides the shortlist; these signals decide the order within it.
      const quality = card.qualityScore / 100;
      const popularity = Math.min(1, card.savesCount / 5000);
      const freshness = freshnessFactor(card.publishedAt);
      const editorial = card.isEditorPick ? 1 : 0;
      const finalScore =
        parts.rrf * 100 +
        SCORE_WEIGHTS.quality * quality +
        SCORE_WEIGHTS.popularity * popularity +
        SCORE_WEIGHTS.freshness * freshness +
        SCORE_WEIGHTS.editorial * editorial;
      return { ...card, ...parts, finalScore };
    })
    .sort((a, b) => b.finalScore - a.finalScore);

  return {
    hits: hits.slice(offset, offset + limit),
    total: hits.length,
    mode,
    durationMs: Date.now() - startedAt,
    topicMatches,
    didYouMean: hits.length < 3 ? await suggestAlternative(text) : null,
  };
}

async function keywordSearch(text: string, where: ReturnType<typeof sql.join>, limit: number) {
  return query<{ id: string; score: number; highlight: string | null }>(sql`
    SELECT r.id,
      ts_rank_cd(r.search_vector, websearch_to_tsquery('english', ${text}))::float AS score,
      ts_headline('english', COALESCE(r.summary, r.description), websearch_to_tsquery('english', ${text}),
        'StartSel=<mark>, StopSel=</mark>, MaxWords=32, MinWords=12, MaxFragments=1') AS highlight
    FROM resources r
    JOIN resource_types rt ON rt.id = r.resource_type_id
    WHERE ${where} AND (
      r.search_vector @@ websearch_to_tsquery('english', ${text})
      OR r.title ILIKE ${`%${text}%`}
    )
    ORDER BY score DESC, r.quality_score DESC
    LIMIT ${limit}
  `);
}

async function semanticSearch(
  embedding: number[],
  where: ReturnType<typeof sql.join>,
  limit: number,
  floor: number,
) {
  const literal = toVectorLiteral(embedding);
  // A nearest-neighbour scan always returns *something*, so the floor is what
  // makes "no semantic match" expressible.
  return query<{ id: string; score: number }>(sql`
    SELECT r.id, (1 - (e.embedding <=> ${literal}::vector))::float AS score
    FROM resources r
    JOIN resource_types rt ON rt.id = r.resource_type_id
    JOIN resource_embeddings e ON e.resource_id = r.id
    WHERE ${where} AND (1 - (e.embedding <=> ${literal}::vector)) >= ${floor}
    ORDER BY e.embedding <=> ${literal}::vector
    LIMIT ${limit}
  `);
}

async function loadCards(ids: string[], userId: string | null): Promise<ResourceListItem[]> {
  return query<ResourceListItem>(sql`
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
      ${userId ? sql`(SELECT b.state FROM bookmarks b WHERE b.resource_id = r.id AND b.user_id = ${userId})` : sql`NULL::learning_state`} AS "bookmarkState"
    FROM resources r
    JOIN resource_types rt ON rt.id = r.resource_type_id
    WHERE ${oneOf(sql`r.id`, ids)}
  `);
}

async function matchTopics(text: string) {
  return query<{ slug: string; name: string; accent: string; icon: string; resourceCount: number }>(sql`
    SELECT t.slug, COALESCE(t.short_name, t.name) AS name, t.accent, t.icon,
      (SELECT COUNT(*)::int FROM resource_topics xt WHERE xt.topic_id = t.id) AS "resourceCount"
    FROM topics t
    WHERE t.name ILIKE ${`%${text}%`} OR t.slug ILIKE ${`%${text}%`} OR COALESCE(t.short_name, '') ILIKE ${`%${text}%`}
    ORDER BY "resourceCount" DESC
    LIMIT 4
  `);
}

/** Trigram-free spelling assist: the closest high-volume past query. */
async function suggestAlternative(text: string): Promise<string | null> {
  const rows = await query<{ query: string }>(sql`
    SELECT normalized_query AS query, COUNT(*)::int AS volume
    FROM search_queries
    WHERE results_count > 0 AND normalized_query <> ${text.toLowerCase()}
    GROUP BY normalized_query
    ORDER BY volume DESC
    LIMIT 40
  `);
  const target = text.toLowerCase();
  let best: { query: string; distance: number } | null = null;
  for (const row of rows) {
    const distance = levenshtein(target, row.query);
    if (distance <= Math.max(2, Math.floor(target.length * 0.34)) && (!best || distance < best.distance)) {
      best = { query: row.query, distance };
    }
  }
  return best?.query ?? null;
}

function freshnessFactor(publishedAt: string | null): number {
  if (!publishedAt) return 0.5;
  const ageDays = (Date.now() - new Date(publishedAt).getTime()) / 86_400_000;
  return Math.max(0.15, Math.pow(0.5, ageDays / 540));
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return matrix[a.length][b.length];
}

export async function getSearchSuggestions(prefix: string, limit = 6) {
  const text = prefix.trim();
  if (text.length < 2) return { resources: [], topics: [] };

  const [resources, topics] = await Promise.all([
    query<{ slug: string; title: string; typeName: string; typeAccent: string }>(sql`
      SELECT r.slug, r.title, rt.name AS "typeName", rt.accent AS "typeAccent"
      FROM resources r JOIN resource_types rt ON rt.id = r.resource_type_id
      WHERE r.status = 'published' AND r.title ILIKE ${`%${text}%`}
      ORDER BY r.quality_score DESC LIMIT ${limit}
    `),
    query<{ slug: string; name: string; accent: string; icon: string }>(sql`
      SELECT slug, COALESCE(short_name, name) AS name, accent, icon FROM topics
      WHERE name ILIKE ${`%${text}%`} OR slug ILIKE ${`%${text}%`} LIMIT 4
    `),
  ]);
  return { resources, topics };
}
