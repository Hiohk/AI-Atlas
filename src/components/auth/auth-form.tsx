"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useId, useState } from "react";
import { signInAction, signUpAction, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Callout } from "@/components/ui/primitives";
import { useDictionary } from "@/components/providers/preferences-provider";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

const DEMO_ACCOUNTS = [
  { email: "sierra@ai-atlas.dev", password: "atlas1234", roleKey: "admin" as const },
  { email: "mira@ai-atlas.dev", password: "atlas1234", roleKey: "editor" as const },
  { email: "kai@ai-atlas.dev", password: "atlas1234", roleKey: "learner" as const },
];

export function AuthForm({ mode }: { mode: Mode }) {
  const dict = useDictionary();
  const isSignUp = mode === "signup";
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "";

  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    isSignUp ? signUpAction : signInAction,
    null,
  );

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  const fieldErrors = state?.fieldErrors ?? {};
  const otherHref = `${isSignUp ? "/login" : "/signup"}${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`;

  function fillFromDemoAccount(account: (typeof DEMO_ACCOUNTS)[number]) {
    setIdentifier(account.email);
    setPassword(account.password);
  }

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="redirectTo" value={redirectTo} />

        {state?.error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-2.5 text-[13px] text-rose-800"
          >
            <Icon name="shield" className="mt-0.5 size-4 shrink-0" />
            <span>{state.error}</span>
          </div>
        ) : null}

        {isSignUp ? (
          <>
            <Field
              name="displayName"
              label={dict.auth.displayName}
              autoComplete="name"
              placeholder="Sierra Chen"
              value={displayName}
              onValueChange={setDisplayName}
              error={fieldErrors.displayName}
            />
            <Field
              name="username"
              label={dict.auth.username}
              autoComplete="username"
              placeholder="sierra"
              value={username}
              onValueChange={setUsername}
              error={fieldErrors.username}
            />
            <Field
              name="email"
              label={dict.auth.email}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onValueChange={setEmail}
              error={fieldErrors.email}
            />
            <Field
              name="password"
              label={dict.auth.password}
              type="password"
              autoComplete="new-password"
              placeholder={dict.auth.passwordPlaceholder}
              hint={dict.auth.passwordHint}
              value={password}
              onValueChange={setPassword}
              error={fieldErrors.password}
            />
          </>
        ) : (
          <>
            <Field
              name="identifier"
              label={dict.auth.identifier}
              autoComplete="username"
              placeholder="you@example.com"
              value={identifier}
              onValueChange={setIdentifier}
              error={fieldErrors.identifier}
            />
            <Field
              name="password"
              label={dict.auth.password}
              type="password"
              autoComplete="current-password"
              value={password}
              onValueChange={setPassword}
              error={fieldErrors.password}
            />
          </>
        )}

        <Button type="submit" size="md" className="w-full" disabled={isPending}>
          {isPending ? <Icon name="loader" className="size-4 animate-spin" /> : null}
          {isSignUp ? dict.auth.createAccount : dict.auth.signIn}
        </Button>
      </form>

      {isSignUp ? null : (
        <Callout tone="brand" icon="sparkles" title={dict.auth.demoTitle}>
          <p className="text-[13px] text-brand-800/90">{dict.auth.demoBody}</p>
          <div className="mt-2.5 space-y-1.5">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => fillFromDemoAccount(account)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-brand-100 bg-surface/70 px-2.5 py-1.5 text-left transition-colors hover:border-brand-200 hover:bg-surface"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-ink">{account.email}</span>
                  <span className="block font-mono text-[11px] text-muted">{account.password}</span>
                </span>
                <span className="shrink-0 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700">
                  {dict.auth[account.roleKey]}
                </span>
              </button>
            ))}
          </div>
        </Callout>
      )}

      <p className="text-center text-[13px] text-muted">
        {isSignUp ? dict.auth.haveAccount : dict.auth.newHere}{" "}
        <Link href={otherHref} className="font-medium text-brand-600 hover:text-brand-700">
          {isSignUp ? dict.auth.signIn : dict.auth.createOne}
        </Link>
      </p>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  autoComplete,
  placeholder,
  hint,
  value,
  onValueChange,
  error,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
}) {
  const id = useId();
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ");

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          "h-10 w-full rounded-xl border border-hairline bg-surface px-3 text-sm text-ink transition-colors outline-none placeholder:text-slate-400 focus:border-brand-300",
          error && "border-rose-300 focus:border-rose-400",
        )}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
