import { sql } from "drizzle-orm";
import { execute } from "@/lib/db/query";

export type AtlasEvent =
  | "page_view"
  | "resource_view"
  | "resource_click"
  | "resource_save"
  | "resource_unsave"
  | "resource_complete"
  | "search"
  | "search_result_click"
  | "topic_view"
  | "path_view"
  | "path_start"
  | "path_complete"
  | "resource_submit"
  | "resource_approve"
  | "resource_reject";

type TrackOptions = {
  userId?: string | null;
  resourceId?: string | null;
  topicId?: string | null;
  pathId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Analytics is never allowed to break a page render, so failures are logged and
 * swallowed. Counter updates live alongside the event write: the daily rollup
 * powers trending, the denormalised counter powers card display.
 */
export async function track(event: AtlasEvent, options: TrackOptions = {}): Promise<void> {
  try {
    await execute(sql`
      INSERT INTO resource_events (event_name, user_id, resource_id, topic_id, path_id, session_id, metadata)
      VALUES (${event}, ${options.userId ?? null}, ${options.resourceId ?? null}, ${options.topicId ?? null},
              ${options.pathId ?? null}, ${options.sessionId ?? null}, ${JSON.stringify(options.metadata ?? {})}::jsonb)
    `);

    const column = COUNTER_COLUMNS[event];
    if (column && options.resourceId) {
      await execute(sql`
        UPDATE resources SET ${sql.raw(column.resource)} = ${sql.raw(column.resource)} + 1 WHERE id = ${options.resourceId}
      `);
      await execute(sql`
        INSERT INTO resource_daily_stats (resource_id, day, ${sql.raw(column.daily)})
        VALUES (${options.resourceId}, CURRENT_DATE, 1)
        ON CONFLICT (resource_id, day)
        DO UPDATE SET ${sql.raw(column.daily)} = resource_daily_stats.${sql.raw(column.daily)} + 1
      `);
    }

    if (event === "topic_view" && options.topicId) {
      await execute(sql`
        INSERT INTO topic_daily_stats (topic_id, day, views, attention)
        VALUES (${options.topicId}, CURRENT_DATE, 1, 0.01)
        ON CONFLICT (topic_id, day)
        DO UPDATE SET views = topic_daily_stats.views + 1, attention = topic_daily_stats.attention + 0.01
      `);
    }
  } catch (error) {
    console.error(`[analytics] failed to record ${event}:`, (error as Error).message);
  }
}

const COUNTER_COLUMNS: Partial<Record<AtlasEvent, { resource: string; daily: string }>> = {
  resource_view: { resource: "views_count", daily: "views" },
  resource_click: { resource: "clicks_count", daily: "clicks" },
  resource_save: { resource: "saves_count", daily: "saves" },
  resource_complete: { resource: "completions_count", daily: "completions" },
};

export async function logSearch({
  query: text,
  userId,
  resultsCount,
  mode,
  durationMs,
}: {
  query: string;
  userId?: string | null;
  resultsCount: number;
  mode: string;
  durationMs: number;
}): Promise<void> {
  try {
    await execute(sql`
      INSERT INTO search_queries (query, normalized_query, user_id, results_count, mode, duration_ms)
      VALUES (${text}, ${text.trim().toLowerCase()}, ${userId ?? null}, ${resultsCount}, ${mode}, ${durationMs})
    `);
  } catch (error) {
    console.error("[analytics] failed to log search:", (error as Error).message);
  }
}

/** Decrementing on unsave keeps the displayed count honest. */
export async function decrementSaves(resourceId: string): Promise<void> {
  try {
    await execute(sql`UPDATE resources SET saves_count = GREATEST(0, saves_count - 1) WHERE id = ${resourceId}`);
  } catch (error) {
    console.error("[analytics] failed to decrement saves:", (error as Error).message);
  }
}
