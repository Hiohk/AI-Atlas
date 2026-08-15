import { sql } from "drizzle-orm";
import { query, queryOne } from "@/lib/db/query";

export type TopicSummary = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  tagline: string | null;
  icon: string;
  accent: string;
  isFeatured: boolean;
  parentSlug: string | null;
  /** Includes the whole subtree, so a parent never appears emptier than a child. */
  resourceCount: number;
  childCount: number;
};

/** Resource counts roll up through the topic tree. */
const SUBTREE_COUNT = sql`(
  SELECT COUNT(DISTINCT xt.resource_id)::int
  FROM resource_topics xt
  JOIN resources r ON r.id = xt.resource_id AND r.status = 'published' AND r.visibility = 'public'
  WHERE xt.topic_id IN (
    WITH RECURSIVE subtree AS (
      SELECT id FROM topics WHERE id = t.id
      UNION ALL
      SELECT c.id FROM topics c JOIN subtree s ON c.parent_id = s.id
    ) SELECT id FROM subtree
  )
)`;

export async function listTopics({ featuredOnly = false, topLevelOnly = true, limit }: { featuredOnly?: boolean; topLevelOnly?: boolean; limit?: number } = {}): Promise<TopicSummary[]> {
  const conditions = [sql`TRUE`];
  if (featuredOnly) conditions.push(sql`t.is_featured`);
  if (topLevelOnly) conditions.push(sql`t.parent_id IS NULL`);

  return query<TopicSummary>(sql`
    SELECT t.id, t.slug, t.name, t.short_name AS "shortName", t.tagline, t.icon, t.accent,
      t.is_featured AS "isFeatured",
      (SELECT slug FROM topics p WHERE p.id = t.parent_id) AS "parentSlug",
      ${SUBTREE_COUNT} AS "resourceCount",
      (SELECT COUNT(*)::int FROM topics c WHERE c.parent_id = t.id) AS "childCount"
    FROM topics t
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY "resourceCount" DESC, t.sort_order
    ${limit ? sql`LIMIT ${limit}` : sql``}
  `);
}

export type TopicDetail = TopicSummary & {
  description: string | null;
  children: TopicSummary[];
  related: Array<{ slug: string; name: string; accent: string; icon: string }>;
  pathCount: number;
  contributorCount: number;
  learnerCount: number;
};

export async function getTopicBySlug(slug: string): Promise<TopicDetail | null> {
  const topic = await queryOne<TopicSummary & { description: string | null }>(sql`
    SELECT t.id, t.slug, t.name, t.short_name AS "shortName", t.tagline, t.description, t.icon, t.accent,
      t.is_featured AS "isFeatured",
      (SELECT slug FROM topics p WHERE p.id = t.parent_id) AS "parentSlug",
      ${SUBTREE_COUNT} AS "resourceCount",
      (SELECT COUNT(*)::int FROM topics c WHERE c.parent_id = t.id) AS "childCount"
    FROM topics t WHERE t.slug = ${slug} LIMIT 1
  `);
  if (!topic) return null;

  const [children, related, extras] = await Promise.all([
    query<TopicSummary>(sql`
      SELECT t.id, t.slug, t.name, t.short_name AS "shortName", t.tagline, t.icon, t.accent,
        t.is_featured AS "isFeatured", ${sql.raw(`'${slug}'`)} AS "parentSlug",
        ${SUBTREE_COUNT} AS "resourceCount", 0 AS "childCount"
      FROM topics t WHERE t.parent_id = ${topic.id}
      ORDER BY "resourceCount" DESC, t.sort_order
    `),
    query<{ slug: string; name: string; accent: string; icon: string }>(sql`
      SELECT t.slug, COALESCE(t.short_name, t.name) AS name, t.accent, t.icon
      FROM related_topics rel JOIN topics t ON t.id = rel.related_topic_id
      WHERE rel.topic_id = ${topic.id}
      ORDER BY rel.weight DESC LIMIT 8
    `),
    queryOne<{ pathCount: number; contributorCount: number; learnerCount: number }>(sql`
      SELECT
        (SELECT COUNT(DISTINCT lp.id)::int
           FROM learning_paths lp
           JOIN learning_path_stages s ON s.path_id = lp.id
           JOIN learning_path_resources lpr ON lpr.stage_id = s.id
           JOIN resource_topics xt ON xt.resource_id = lpr.resource_id
          WHERE xt.topic_id = ${topic.id}) AS "pathCount",
        (SELECT COUNT(DISTINCT r.created_by)::int
           FROM resources r JOIN resource_topics xt ON xt.resource_id = r.id
          WHERE xt.topic_id = ${topic.id} AND r.created_by IS NOT NULL) AS "contributorCount",
        (SELECT COUNT(DISTINCT b.user_id)::int
           FROM bookmarks b JOIN resource_topics xt ON xt.resource_id = b.resource_id
          WHERE xt.topic_id = ${topic.id}) AS "learnerCount"
    `),
  ]);

  return {
    ...topic,
    children,
    related,
    pathCount: extras?.pathCount ?? 0,
    contributorCount: extras?.contributorCount ?? 0,
    learnerCount: extras?.learnerCount ?? 0,
  };
}

export async function getTopicBreadcrumb(slug: string): Promise<Array<{ slug: string; name: string }>> {
  const rows = await query<{ slug: string; name: string; depth: number }>(sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id, slug, COALESCE(short_name, name) AS name, 0 AS depth FROM topics WHERE slug = ${slug}
      UNION ALL
      SELECT p.id, p.parent_id, p.slug, COALESCE(p.short_name, p.name), a.depth + 1
      FROM topics p JOIN ancestors a ON p.id = a.parent_id
    )
    SELECT slug, name, depth FROM ancestors ORDER BY depth DESC
  `);
  return rows.map(({ slug: s, name }) => ({ slug: s, name }));
}

export async function getTopicSlugs(): Promise<string[]> {
  const rows = await query<{ slug: string }>(sql`SELECT slug FROM topics ORDER BY slug`);
  return rows.map((row) => row.slug);
}
