import type { Metadata } from "next";
import Link from "next/link";
import { SubmitForm } from "@/components/submit/submit-form";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Callout, Card, Eyebrow, IconTile, Panel, Progress, Stat } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth/session";
import { getDictionary, getLocale } from "@/lib/i18n";
import { formatMessage, type Dictionary } from "@/lib/i18n/dictionary";
import { getSubmissionStats, listMySubmissions } from "@/lib/queries/submissions";
import { checkSubmissionQuota } from "@/lib/rate-limit";
import { cn, relativeTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Submit a resource",
  description:
    "Add a paper, course, repository or tool to AI Atlas. Paste a URL and the pipeline extracts, classifies and scores it for editorial review.",
};

const STATUS_STYLES: Record<string, { key: keyof Dictionary["submit"]; className: string }> = {
  submitted: { key: "queued", className: "bg-slate-100 text-slate-600" },
  fetching: { key: "fetching", className: "bg-brand-50 text-brand-700" },
  analyzing: { key: "analyzing", className: "bg-brand-50 text-brand-700" },
  duplicate_check: { key: "deduplicating", className: "bg-brand-50 text-brand-700" },
  ready_for_review: { key: "inReviewStatus", className: "bg-amber-50 text-amber-700" },
  approved: { key: "approved", className: "bg-emerald-50 text-emerald-700" },
  published: { key: "published", className: "bg-emerald-50 text-emerald-700" },
  rejected: { key: "notAccepted", className: "bg-rose-50 text-rose-700" },
  failed: { key: "failedStatus", className: "bg-rose-50 text-rose-700" },
};

export default async function SubmitPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const [user, params, dict, locale] = await Promise.all([getCurrentUser(), searchParams, getDictionary(), getLocale()]);

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <IconTile icon="plus" accent="indigo" size="lg" className="mx-auto" />
        <h1 className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-ink">{dict.submit.title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{dict.submit.signInBody}</p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <ButtonLink href="/login?redirectTo=/submit">{dict.nav.signIn}</ButtonLink>
          <ButtonLink href="/signup?redirectTo=/submit" variant="outline">
            {dict.auth.createOne}
          </ButtonLink>
        </div>
        <PipelineExplainer className="mt-12 text-left" dict={dict} />
      </div>
    );
  }

  const [quota, stats, mine] = await Promise.all([
    checkSubmissionQuota(user.id, user.role, user.isTrusted),
    getSubmissionStats(user.id),
    listMySubmissions(user.id, 8),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <Eyebrow icon="plus">{dict.submit.contribute}</Eyebrow>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-ink">{dict.submit.addTitle}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{dict.submit.addBody}</p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Panel className="p-6">
            <SubmitForm defaultUrl={params.url ?? ""} />
          </Panel>

          {!quota.ok && (
            <Callout tone="amber" icon="clock" title={dict.submit.dailyLimit}>
              {formatMessage(dict.submit.dailyLimitBody, { limit: quota.limit })}
            </Callout>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Icon name="check-circle" className="size-4 text-emerald-600" />
                {dict.submit.wantTitle}
              </h2>
              <ul className="mt-3 space-y-2">
                {[dict.submit.want1, dict.submit.want2, dict.submit.want3, dict.submit.want4].map((item) => (
                  <li key={item} className="flex gap-2 text-[13px] leading-relaxed text-muted">
                    <Icon name="check" className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Icon name="x" className="size-4 text-rose-500" />
                {dict.submit.rejectTitle}
              </h2>
              <ul className="mt-3 space-y-2">
                {[dict.submit.reject1, dict.submit.reject2, dict.submit.reject3].map((item) => (
                  <li key={item} className="flex gap-2 text-[13px] leading-relaxed text-muted">
                    <Icon name="x" className="mt-0.5 size-3.5 shrink-0 text-rose-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <PipelineExplainer dict={dict} />

          {mine.length > 0 && (
            <Panel className="p-5">
              <h2 className="text-sm font-semibold text-ink">{dict.submit.yourSubmissions}</h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {mine.map((item) => {
                  const style = STATUS_STYLES[item.status] ?? STATUS_STYLES.submitted;
                  return (
                    <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink">
                          {item.resourceSlug ? (
                            <Link href={`/resources/${item.resourceSlug}`} className="hover:text-brand-700">
                              {item.title ?? item.url}
                            </Link>
                          ) : (
                            (item.title ?? item.url)
                          )}
                        </p>
                        <p className="truncate text-[11px] text-muted">
                          {hostOf(item.url)}
                          <span className="mx-1.5">·</span>
                          {relativeTime(item.createdAt, locale)}
                          {item.errorMessage && <span className="ml-1.5 text-rose-600">{item.errorMessage}</span>}
                        </p>
                      </div>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", style.className)}>
                        {dict.submit[style.key]}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
        </div>

        <aside className="space-y-5">
          <Panel className="p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{dict.submit.quotaTitle}</h2>
            <p className="mt-2 text-2xl font-semibold text-ink tabular-nums">
              {quota.limit - quota.used}
              <span className="ml-1 text-sm font-normal text-muted">{formatMessage(dict.submit.quotaLeft, { limit: quota.limit })}</span>
            </p>
            <Progress value={(quota.used / quota.limit) * 100} className="mt-3" />
            <p className="mt-2 text-[12px] text-muted">
              {user.isTrusted ? dict.submit.trustedNote : dict.submit.raiseNote}
            </p>
          </Panel>

          <Panel className="p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{dict.submit.contribution}</h2>
            <div className="mt-3 space-y-3">
              <Stat icon="plus" label={dict.submit.submitted} value={stats?.total ?? 0} />
              <Stat icon="check-circle" label={dict.submit.published} value={stats?.published ?? 0} />
              <Stat icon="clock" label={dict.submit.inReview} value={stats?.pending ?? 0} />
            </div>
          </Panel>

          <Callout tone="brand" icon="shield-check" title={dict.submit.safetyTitle}>
            {dict.submit.safetyBody}
          </Callout>
        </aside>
      </div>
    </div>
  );
}

function PipelineExplainer({ className, dict }: { className?: string; dict: Dictionary }) {
  const steps = [
    { icon: "shield-check" as const, title: dict.submit.validate, body: dict.submit.validateBody },
    { icon: "search" as const, title: dict.submit.fetch, body: dict.submit.fetchBody },
    { icon: "sparkles" as const, title: dict.submit.analyse, body: dict.submit.analyseBody },
    { icon: "gauge" as const, title: dict.submit.score, body: dict.submit.scoreBody },
    { icon: "repeat" as const, title: dict.submit.dedupe, body: dict.submit.dedupeBody },
    { icon: "pen-line" as const, title: dict.submit.review, body: dict.submit.reviewBody },
  ];

  return (
    <Card className={cn("p-5", className)}>
      <h2 className="text-sm font-semibold text-ink">{dict.submit.afterSubmit}</h2>
      <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <IconTile icon={step.icon} accent="indigo" size="sm" />
            <div>
              <p className="text-[13px] font-semibold text-ink">
                <span className="mr-1.5 text-muted tabular-nums">{index + 1}</span>
                {step.title}
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
