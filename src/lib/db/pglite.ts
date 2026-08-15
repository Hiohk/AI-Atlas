import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PGlite } from "@electric-sql/pglite";

const LOCK_NAME = ".atlas.lock";

type Cached = { __aiAtlasPglite?: Promise<PGlite> };

function cache(): Cached {
  return globalThis as unknown as Cached;
}

export function pgliteDataDir() {
  return resolve(process.cwd(), process.env.PGLITE_DATA_DIR ?? ".pglite");
}

function lockPath(dir: string) {
  return resolve(dir, LOCK_NAME);
}

function isPidAlive(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLockPid(dir: string): number | null {
  const path = lockPath(dir);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { pid?: number };
    return typeof parsed.pid === "number" ? parsed.pid : -1;
  } catch {
    return -1;
  }
}

function writeLock(dir: string) {
  writeFileSync(lockPath(dir), `${JSON.stringify({ pid: process.pid, at: Date.now() })}\n`);
}

function removeIfPresent(path: string) {
  if (existsSync(path)) unlinkSync(path);
}

/** Drop leftover Postgres/WASM lock files from a process that exited uncleanly. */
function clearStaleLocks(dir: string) {
  removeIfPresent(lockPath(dir));
  removeIfPresent(resolve(dir, "postmaster.pid"));
}

function alreadyOpenError(pid: number, dir: string) {
  return new Error(
    `Embedded Postgres is already open in another process (pid ${pid}). PGlite can only mount ${dir} once — stop the extra \`next dev\` / \`next start\` and retry.`,
  );
}

/**
 * One PGlite per Node process. Next.js webpack graphs (RSC vs actions) and
 * hot reloads would otherwise each call `PGlite.create()` against the same
 * directory; the WASM build then aborts with an unreadable `Aborted()`.
 *
 * `generateStaticParams` still runs in a worker and must not open `.pglite/`
 * while `next dev` holds it — those pages skip prerender when embedded.
 */
export function createEmbeddedPglite(): Promise<PGlite> {
  const slot = cache();
  slot.__aiAtlasPglite ??= openPglite().catch((error) => {
    slot.__aiAtlasPglite = undefined;
    throw error;
  });
  return slot.__aiAtlasPglite;
}

async function openPglite(): Promise<PGlite> {
  const dataDir = pgliteDataDir();
  const owner = readLockPid(dataDir);

  if (owner != null && owner !== process.pid && isPidAlive(owner)) {
    throw alreadyOpenError(owner, dataDir);
  }
  if (owner != null && owner !== process.pid) {
    clearStaleLocks(dataDir);
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { vector } = await import("@electric-sql/pglite-pgvector");

  try {
    const client = await PGlite.create({ dataDir, extensions: { vector } });
    writeLock(dataDir);
    return client;
  } catch {
    const stillOwned = readLockPid(dataDir);
    if (stillOwned != null && stillOwned !== process.pid && isPidAlive(stillOwned)) {
      throw alreadyOpenError(stillOwned, dataDir);
    }

    // Crashed `next dev` leaves `postmaster.pid`; the next boot then WASM-aborts.
    clearStaleLocks(dataDir);
    try {
      const client = await PGlite.create({ dataDir, extensions: { vector } });
      writeLock(dataDir);
      return client;
    } catch {
      throw new Error(
        `PGlite failed to open ${dataDir}. Another Next.js process is likely already using it (check ports 3000/3001/4000), or the data directory is corrupt. Stop extra \`next dev\` / \`next start\` processes and restart this one, or run \`npm run db:reset\`.`,
      );
    }
  }
}
