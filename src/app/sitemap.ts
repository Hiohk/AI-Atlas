import type { MetadataRoute } from "next";
import { sql } from "drizzle-orm";
import { query } from "@/lib/db/query";
import { siteConfig } from "@/lib/config";
import { getPathSlugs } from "@/lib/queries/paths";
import { getTopicSlugs } from "@/lib/queries/topics";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url.replace(/\/$/, "");

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/explore`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/resources`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/paths`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/trending`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/submit`, changeFrequency: "monthly", priority: 0.4 },
  ];

  try {
    const [resources, topicSlugs, pathSlugs] = await Promise.all([
      query<{ slug: string; updatedAt: string }>(sql`
        SELECT slug, updated_at AS "updatedAt" FROM resources
        WHERE status = 'published' AND visibility = 'public'
        ORDER BY updated_at DESC LIMIT 5000
      `),
      getTopicSlugs(),
      getPathSlugs(),
    ]);

    return [
      ...staticRoutes,
      ...topicSlugs.map((slug) => ({
        url: `${base}/topics/${slug}`,
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
      ...pathSlugs.map((slug) => ({
        url: `${base}/paths/${slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...resources.map((resource) => ({
        url: `${base}/resources/${resource.slug}`,
        lastModified: new Date(resource.updatedAt),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    ];
  } catch {
    // A sitemap must still build when the database is unreachable.
    return staticRoutes;
  }
}
