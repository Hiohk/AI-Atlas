import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { Logo } from "@/components/layout/logo";
import { Panel, Skeleton } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to AI Atlas to save resources, track your progress and submit new ones.",
};

export default async function LoginPage() {
  const [user, dict] = await Promise.all([getCurrentUser(), getDictionary()]);
  if (user) redirect("/me");

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-16 sm:px-6">
      <header className="flex flex-col items-center text-center">
        <Logo />
        <h1 className="mt-6 text-2xl font-semibold tracking-[-0.02em] text-ink">{dict.auth.signInTitle}</h1>
        <p className="mt-1.5 text-sm text-muted">{dict.auth.signInSubtitle}</p>
      </header>

      <Panel className="mt-7 p-6">
        <Suspense fallback={<AuthFormFallback />}>
          <AuthForm mode="signin" />
        </Suspense>
      </Panel>
    </div>
  );
}

function AuthFormFallback() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  );
}
