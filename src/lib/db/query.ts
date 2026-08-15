import { sql, type SQL } from "drizzle-orm";
import { getDb } from "./client";

/**
 * Membership test for a list of values.
 *
 * Drizzle renders an array parameter as a placeholder list — `($1, $2, …)` —
 * which is an `IN` operand rather than an array value, so the tempting
 * `= ANY(${values})` fails to parse. An empty list yields `false`, because
 * `IN ()` is a syntax error and "matches nothing" is the intended meaning.
 */
export function oneOf(column: SQL, values: readonly (string | number)[]): SQL {
  if (values.length === 0) return sql`false`;
  // Bind each value separately. Passing the array as one parameter makes
  // postgres-js / PGlite emit `= ANY($1)` and then reject a scalar like "paper".
  return sql`${column} IN (${sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  )})`;
}

/**
 * Normalises raw SQL results across drivers: postgres-js resolves to an
 * array-like row list, PGlite to `{ rows }`. Everything that needs hand-written
 * SQL goes through here so query code stays driver-agnostic.
 */
export async function query<T = Record<string, unknown>>(statement: SQL): Promise<T[]> {
  const db = await getDb();
  const result = (await db.execute(statement)) as unknown;
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}

export async function queryOne<T = Record<string, unknown>>(statement: SQL): Promise<T | null> {
  const rows = await query<T>(statement);
  return rows[0] ?? null;
}

export async function execute(statement: SQL): Promise<void> {
  const db = await getDb();
  await db.execute(statement);
}
