import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Applies `drizzle/*.sql` in order. Drizzle's own migrator is bypassed on
 * purpose: `CREATE EXTENSION vector` has to run before any `vector(384)` column
 * is created, and the embedded driver needs the statements split by the
 * `statement-breakpoint` markers drizzle-kit emits.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  const dir = join(process.cwd(), "drizzle");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const run = await connect(url);
  await run("CREATE EXTENSION IF NOT EXISTS vector;");
  console.log(`▸ pgvector ready (${url ? "postgres" : "pglite"})`);

  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    let applied = 0;
    let skipped = 0;
    for (const statement of statements) {
      try {
        await run(statement);
        applied++;
      } catch (error) {
        // Re-running the initial migration is a normal operation during
        // development, so pre-existing objects are not a failure.
        if (isAlreadyExists(error)) skipped++;
        else throw new Error(`Failed statement in ${file}:\n${statement.slice(0, 300)}\n\n${String(error)}`);
      }
    }
    console.log(`▸ ${file}: ${applied} applied, ${skipped} already present`);
  }

  console.log("✓ schema up to date");
  process.exit(0);
}

function isAlreadyExists(error: unknown) {
  const code = (error as { code?: string })?.code;
  const message = String((error as { message?: string })?.message ?? error);
  return code === "42P07" || code === "42710" || code === "42P16" || /already exists/i.test(message);
}

async function connect(url: string | undefined): Promise<(sql: string) => Promise<unknown>> {
  if (url) {
    const { default: postgres } = await import("postgres");
    const client = postgres(url, { max: 1 });
    return (sql: string) => client.unsafe(sql);
  }
  const { createEmbeddedPglite } = await import("./pglite.ts");
  const client = await createEmbeddedPglite();
  return (sql: string) => client.exec(sql);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
