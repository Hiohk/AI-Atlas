import { cookies } from "next/headers";
import { cache } from "react";
import { sql } from "drizzle-orm";
import { query, queryOne, execute } from "@/lib/db/query";
import type { UserRole } from "@/lib/db/schema";
import { createSessionToken } from "./password";

export const SESSION_COOKIE = "atlas_session";
const SESSION_TTL_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  headline: string | null;
  role: UserRole;
  isTrusted: boolean;
};

const ROLE_RANK: Record<UserRole, number> = { user: 0, contributor: 1, editor: 2, admin: 3 };

/**
 * Deduplicated per request: layout, page and nested components all ask for the
 * current user, and this should stay a single query.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  return queryOne<SessionUser>(sql`
    SELECT p.id, p.email, p.username, p.display_name AS "displayName", p.avatar_url AS "avatarUrl",
           p.headline, p.role, p.is_trusted AS "isTrusted"
    FROM sessions s JOIN profiles p ON p.id = s.user_id
    WHERE s.token = ${token} AND s.expires_at > NOW()
    LIMIT 1
  `);
});

export async function getCurrentUserId(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}

export function hasRole(user: SessionUser | null, minimum: UserRole): boolean {
  if (!user) return false;
  return ROLE_RANK[user.role] >= ROLE_RANK[minimum];
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You need to be signed in to do that.");
  return user;
}

export async function requireRole(minimum: UserRole): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasRole(user, minimum)) throw new Error("You do not have permission to do that.");
  return user;
}

export async function startSession(userId: string): Promise<void> {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);

  await execute(sql`INSERT INTO sessions (token, user_id, expires_at) VALUES (${token}, ${userId}, ${expiresAt.toISOString()})`);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await execute(sql`DELETE FROM sessions WHERE token = ${token}`);
  jar.delete(SESSION_COOKIE);
}

/** Housekeeping for expired rows; called opportunistically on sign-in. */
export async function pruneSessions(): Promise<void> {
  await execute(sql`DELETE FROM sessions WHERE expires_at < NOW()`);
}

export async function getUserByEmailOrUsername(identifier: string) {
  const value = identifier.trim().toLowerCase();
  return queryOne<{ id: string; passwordHash: string | null; role: UserRole }>(sql`
    SELECT id, password_hash AS "passwordHash", role FROM profiles
    WHERE lower(email) = ${value} OR lower(username) = ${value}
    LIMIT 1
  `);
}

export async function listContributors(limit = 12) {
  return query<{ username: string; displayName: string; avatarUrl: string | null; headline: string | null; contributions: number }>(sql`
    SELECT p.username, p.display_name AS "displayName", p.avatar_url AS "avatarUrl", p.headline,
      COUNT(r.id)::int AS contributions
    FROM profiles p
    LEFT JOIN resources r ON r.created_by = p.id AND r.status = 'published'
    GROUP BY p.id
    ORDER BY contributions DESC
    LIMIT ${limit}
  `);
}
