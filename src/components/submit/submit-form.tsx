"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { submitResourceAction, type SubmitState } from "@/app/actions/submissions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Callout } from "@/components/ui/primitives";
import { useDictionary } from "@/components/providers/preferences-provider";
import { formatMessage } from "@/lib/i18n/dictionary";
import { PIPELINE_STAGES, TERMINAL_STATUSES, type SubmissionProgress } from "@/lib/pipeline/stages";
import { cn } from "@/lib/utils";

const TERMINAL: string[] = TERMINAL_STATUSES;

export function SubmitForm({ defaultUrl = "" }: { defaultUrl?: string }) {
  const dict = useDictionary();
  const [state, formAction, isPending] = useActionState<SubmitState, FormData>(submitResourceAction, { status: "idle" });

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="url" className="text-[13px] font-medium text-ink">
            {dict.submit.url}
          </label>
          <div className="mt-1.5 flex gap-2">
            <div className="relative flex-1">
              <Icon name="link" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                id="url"
                name="url"
                type="text"
                required
                defaultValue={defaultUrl}
                placeholder="https://arxiv.org/abs/2501.12948"
                autoComplete="off"
                spellCheck={false}
                className="h-11 w-full rounded-xl border border-hairline bg-surface pl-9 pr-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <Button type="submit" disabled={isPending} size="lg">
              {isPending ? (
                <>
                  <Icon name="loader" className="size-4 animate-spin" />
                  {dict.submit.submitting}
                </>
              ) : (
                dict.submit.submitBtn
              )}
            </Button>
          </div>
          <p className="mt-1.5 text-[12px] text-muted">{dict.submit.urlHint}</p>
        </div>

        <div>
          <label htmlFor="note" className="text-[13px] font-medium text-ink">
            {dict.submit.note} <span className="font-normal text-muted">{dict.submit.optional}</span>
          </label>
          <textarea
            id="note"
            name="note"
            rows={3}
            maxLength={500}
            placeholder={dict.submit.notePlaceholder}
            className="mt-1.5 w-full resize-y rounded-xl border border-hairline bg-surface px-3 py-2 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </form>

      {state.status === "error" && (
        <Callout tone="rose" icon="shield" title={dict.submit.notSubmitted}>
          {state.message}
        </Callout>
      )}

      {state.status === "queued" && <PipelineMonitor submissionId={state.submissionId} />}
    </div>
  );
}

/**
 * Polls until the pipeline reaches a terminal state. Backs off gradually so a
 * slow provider does not turn into a request storm.
 */
function PipelineMonitor({ submissionId }: { submissionId: string }) {
  const dict = useDictionary();
  const [progress, setProgress] = useState<SubmissionProgress | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function poll() {
      try {
        const response = await fetch(`/api/submissions/${submissionId}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as SubmissionProgress;
        if (!cancelled) {
          setProgress(data);
          if (!TERMINAL.includes(data.status)) setAttempts((n) => n + 1);
        }
      } catch {
        // Aborted or offline; the next tick retries.
      }
    }

    if (progress && TERMINAL.includes(progress.status)) return;
    if (attempts > 40) return;

    const delay = attempts === 0 ? 350 : Math.min(2500, 600 + attempts * 150);
    const timer = setTimeout(poll, delay);
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [submissionId, attempts, progress]);

  const status = progress?.status ?? "submitted";
  const currentIndex = PIPELINE_STAGES.findIndex((stage) => stage.status === status);
  const isFailed = status === "failed";
  const isDone = status === "ready_for_review" || status === "approved" || status === "published";

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">
          {isFailed ? dict.submit.failed : isDone ? dict.submit.inQueue : dict.submit.processing}
        </h3>
        {!isDone && !isFailed && <Icon name="loader" className="size-4 animate-spin text-brand-600" />}
      </div>

      <ol className="mt-4 space-y-3">
        {PIPELINE_STAGES.map((stage, index) => {
          const reached = isDone ? true : currentIndex >= 0 ? index <= currentIndex : index === 0;
          const active = index === currentIndex && !isDone;
          const event = progress?.events?.find((e) => e.stage === stage.status || e.stage === stage.label.toLowerCase());
          return (
            <li key={stage.status} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                  isFailed && active
                    ? "border-rose-200 bg-rose-50 text-rose-600"
                    : reached
                      ? "border-brand-200 bg-brand-600 text-white"
                      : "border-hairline bg-surface text-slate-400",
                )}
              >
                {reached && !active ? <Icon name="check" className="size-3" /> : index + 1}
              </span>
              <div className="min-w-0">
                <p className={cn("text-[13px] font-medium", reached ? "text-ink" : "text-muted")}>
                  {stage.label}
                  {event?.durationMs != null && (
                    <span className="ml-2 text-[11px] font-normal text-muted tabular-nums">{event.durationMs}ms</span>
                  )}
                </p>
                <p className="text-[12px] text-muted">{stage.description}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {isFailed && progress?.errorMessage && (
        <Callout tone="rose" className="mt-4">
          {progress.errorMessage}
        </Callout>
      )}

      {progress?.duplicateSlug && (
        <Callout tone="amber" icon="repeat" title={dict.submit.alreadyTitle} className="mt-4">
          {dict.submit.alreadyBefore}{" "}
          <Link href={`/resources/${progress.duplicateSlug}`} className="font-semibold underline">
            {progress.duplicateTitle}
          </Link>
          {progress.duplicateSimilarity != null && (
            <span className="tabular-nums"> ({Math.round(progress.duplicateSimilarity * 100)}% similar)</span>
          )}
          {dict.submit.alreadyAfter}
        </Callout>
      )}

      {progress?.draft?.title && (
        <div className="mt-4 rounded-xl border border-hairline bg-slate-50/60 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{dict.submit.extracted}</p>
          <p className="mt-1.5 text-sm font-semibold text-ink">{progress.draft.title}</p>
          {progress.draft.description && <p className="mt-1 text-[13px] leading-relaxed text-muted">{progress.draft.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
            {progress.draft.type && (
              <span className="rounded-full bg-surface px-2 py-0.5 font-medium capitalize text-ink ring-1 ring-hairline">
                {progress.draft.type.replace(/-/g, " ")}
              </span>
            )}
            {progress.draft.difficulty && (
              <span className="rounded-full bg-surface px-2 py-0.5 font-medium capitalize text-ink ring-1 ring-hairline">
                {progress.draft.difficulty}
              </span>
            )}
            {progress.draft.qualityScore != null && (
              <span className="rounded-full bg-surface px-2 py-0.5 font-medium text-ink ring-1 ring-hairline tabular-nums">
                {formatMessage(dict.submit.quality, { score: Math.round(progress.draft.qualityScore) })}
              </span>
            )}
            {progress.draft.topics?.slice(0, 4).map((topic) => (
              <span key={topic} className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">
                {topic.replace(/-/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {isDone && (
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href="/submit" variant="secondary" size="sm">
            {dict.submit.submitAnother}
          </ButtonLink>
          {progress?.resourceSlug && (
            <ButtonLink href={`/resources/${progress.resourceSlug}`} size="sm">
              {dict.submit.viewResource}
            </ButtonLink>
          )}
        </div>
      )}
    </div>
  );
}
