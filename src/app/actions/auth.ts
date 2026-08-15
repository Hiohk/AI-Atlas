"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { query, queryOne } from "@/lib/db/query";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { endSession, getUserByEmailOrUsername, pruneSessions, startSession } from "@/lib/auth/session";

export type AuthState = { error?: string; fieldErrors?: Record<string, string> } | null;

const signInSchema = z.object({
  identifier: z.string().min(1, "Enter your email or username."),
  password: z.string().min(1, "Enter your password."),
  redirectTo: z.string().optional(),
});

const signUpSchema = z.object({
  displayName: z.string().min(2, "Tell us what to call you.").max(80),
  username: z
    .string()
    .min(3, "At least 3 characters.")
    .max(30)
    .regex(/^[a-z0-9_-]+$/i, "Letters, numbers, hyphens and underscores only."),
  email: z.string().email("That does not look like an email address."),
  password: z.string().min(8, "Use at least 8 characters."),
  redirectTo: z.string().optional(),
});

export async function signInAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: flatten(parsed.error) };

  const { identifier, password, redirectTo } = parsed.data;
  const account = await getUserByEmailOrUsername(identifier);

  // One generic message for both branches: revealing which half was wrong turns
  // the form into an account-enumeration oracle.
  if (!account || !(await verifyPassword(password, account.passwordHash))) {
    return { error: "Those credentials do not match an account." };
  }

  await pruneSessions();
  await startSession(account.id);
  revalidatePath("/", "layout");
  redirect(safeRedirect(redirectTo));
}

export async function signUpAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: flatten(parsed.error) };

  const { displayName, username, email, password, redirectTo } = parsed.data;

  const clash = await queryOne<{ email: string; username: string }>(sql`
    SELECT email, username FROM profiles WHERE lower(email) = ${email.toLowerCase()} OR lower(username) = ${username.toLowerCase()} LIMIT 1
  `);
  if (clash) {
    return clash.email.toLowerCase() === email.toLowerCase()
      ? { fieldErrors: { email: "An account already uses that email." } }
      : { fieldErrors: { username: "That username is taken." } };
  }

  const [created] = await query<{ id: string }>(sql`
    INSERT INTO profiles (email, username, display_name, password_hash, role)
    VALUES (${email}, ${username}, ${displayName}, ${await hashPassword(password)}, 'user')
    RETURNING id
  `);

  await startSession(created.id);
  revalidatePath("/", "layout");
  redirect(safeRedirect(redirectTo));
}

export async function signOutAction(): Promise<void> {
  await endSession();
  revalidatePath("/", "layout");
  redirect("/");
}

/** Only same-origin paths, so `?redirectTo=` cannot be used for open redirects. */
function safeRedirect(target: string | undefined): string {
  if (!target || !target.startsWith("/") || target.startsWith("//")) return "/me";
  return target;
}

function flatten(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}
