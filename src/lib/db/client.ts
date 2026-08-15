import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { createEmbeddedPglite } from "./pglite";
import * as schema from "./schema";

export type Database = PgliteDatabase<typeof schema>;

/**
 * Two drivers, one schema.
 *
 * - No `DATABASE_URL`: an embedded Postgres 18 (PGlite, WASM) writes to
 *   `.pglite/`. Real Postgres semantics — tsvector FTS, pgvector HNSW — with no
 *   container to run, so `npm run dev` works on a fresh clone.
 * - With `DATABASE_URL`: postgres-js against Supabase/RDS/anything.
 *
 * Because both speak the same dialect, promoting local work to production is a
 * change of environment variable, not a rewrite.
 */
async function createDatabase(): Promise<Database> {
  const url = process.env.DATABASE_URL;

  if (url) {
    const { default: postgres } = await import("postgres");
    const client = postgres(url, { max: 10, prepare: false });
    return drizzlePostgres(client, { schema, casing: "snake_case" }) as unknown as Database;
  }

  const client = await createEmbeddedPglite();
  return drizzlePglite(client, { schema }) as Database;
}

// Next.js recreates modules on every hot reload; PGlite holds an exclusive lock
// on its data directory, so the instance has to outlive the module.
const globalForDb = globalThis as unknown as { __aiAtlasDb?: Promise<Database> };

export function getDb(): Promise<Database> {
  globalForDb.__aiAtlasDb ??= createDatabase().catch((error) => {
    globalForDb.__aiAtlasDb = undefined;
    throw error;
  });
  return globalForDb.__aiAtlasDb;
}

export const isEmbeddedDatabase = () => !process.env.DATABASE_URL;
