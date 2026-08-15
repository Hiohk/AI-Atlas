import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { Logo } from "@/components/layout/logo";
import { Icon, type IconName } from "@/components/ui/icon";
import { Panel, Skeleton } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Create a free AI Atlas account to save resources, track your learning and contribute to the map.",
};

export default async function SignUpPage() {
  const [user, dict] = await Promise.all([getCurrentUser(), getDictionary()]);
  if (user) redirect("/me");

  const benefits: Array<{ icon: IconName; label: string }> = [
    { icon: "bookmark", label: dict.auth.benefit1 },
    { icon: "list-checks", label: dict.auth.benefit2 },
    { icon: "plus", label: dict.auth.benefit3 },
  ];

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-16 sm:px-6">
      <header className="flex flex-col items-center text-center">
        <Logo />
        <h1 className="mt-6 text-2xl font-semibold tracking-[-0.02em] text-ink">{dict.auth.signUpTitle}</h1>
        <p className="mt-1.5 text-sm text-muted">{dict.auth.signUpSubtitle}</p>
      </header>

      <ul className="mt-6 space-y-2">
        {benefits.map((benefit) => (
          <li key={benefit.label} className="flex items-center gap-2.5 text-[13px] text-muted">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Icon name={benefit.icon} className="size-3.5" />
            </span>
            {benefit.label}
          </li>
        ))}
      </ul>

      <Panel className="mt-6 p-6">
        <Suspense fallback={<AuthFormFallback />}>
          <AuthForm mode="signup" />
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
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  );
}
