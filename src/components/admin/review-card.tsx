"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  approveSubmissionAction,
  rejectSubmissionAction,
  retrySubmissionAction,
} from "@/app/actions/submissions";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Avatar, Callout, Card, Chip, Progress, TopicChip } from "@/components/ui/primitives";
import { difficulty as difficultyStyle } from "@/lib/accents";
import type { QueueItem } from "@/lib/queries/admin";
import { cn, relativeTime } from "@/lib/utils";

const RISK_CHIPS: Record<string, string> = {
  high: "bg-rose-50 text-rose-700 ring-rose-100",
  medium: "bg-amber-50 text-amber-700 ring-amber-100",
  low: "bg-emerald-50 text-emerald-700 ring-emerald-100",
};

const STATUS_CHIPS: Record<string, string> = {
  ready_for_review: "bg-amber-50 text-amber-700 ring-amber-100",
  published: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  rejected: "bg-rose-50 text-rose-700 ring-rose-100",
  failed: "bg-rose-50 text-rose-700 ring-rose-100",
};

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function ReviewCard({ item }: { item: QueueItem }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const draft = item.draft;
  const quality = typeof draft?.qualityScore === "number" ? Math.round(draft.qualityScore) : null;
  const level = draft?.difficulty ? difficultyStyle(draft.difficulty) : null;

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Chip className={RISK_CHIPS[item.riskLevel] ?? RISK_CHIPS.low}>{item.riskLevel} risk</Chip>
        <Chip className={STATUS_CHIPS[item.status] ?? "bg-slate-100 text-slate-700 ring-slate-200"}>
          {item.status.replace(/_/g, " ")}
        </Chip>

        {item.submitter ? (
          <span className="flex items-center gap-1.5 text-[12px] text-muted">
            <Avatar src={item.submitter.avatarUrl} name={item.submitter.displayName} size={20} />
            {item.submitter.displayName}
            <span className="text-slate-400">@{item.submitter.username}</span>
          </span>
        ) : (
          <span className="text-[12px] text-muted">Anonymous submission</span>
        )}

        <span className="text-[12px] text-muted">· {relativeTime(item.createdAt)}</span>
        {item.attempts > 1 ? <span className="text-[12px] text-muted">· {item.attempts} attempts</span> : null}

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-brand-600 hover:text-brand-700"
        >
          {hostname(item.canonicalUrl ?? item.url)}
          <Icon name="arrow-up-right" className="size-3.5" />
        </a>
      </div>

      <div className="mt-3.5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]">
        <div className="min-w-0">
          <h3 className="text-[15px] leading-snug font-semibold tracking-[-0.01em] text-ink">
            {draft?.title ?? "Untitled draft"}
          </h3>
          {draft?.authorName || draft?.organizationName ? (
            <p className="mt-0.5 text-xs text-muted">
              {[draft.authorName, draft.organizationName].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          {draft?.description ? (
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{draft.description}</p>
          ) : (
            <p className="mt-2 text-[13px] text-muted italic">The analyser produced no description.</p>
          )}

          {item.note ? (
            <p className="mt-2.5 rounded-lg bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-muted">
              <span className="font-semibold text-ink">Submitter note:</span> {item.note}
            </p>
          ) : null}

          {draft?.topics?.length ? (
            <div className="mt-3 flex flex-wrap gap-1">
              {draft.topics.map((topic) => (
                <TopicChip key={topic} slug={topic} name={topic} />
              ))}
            </div>
          ) : null}

          {draft?.whatYouLearn?.length ? (
            <ul className="mt-3 space-y-1.5">
              {draft.whatYouLearn.slice(0, 5).map((point) => (
                <li key={point} className="flex items-start gap-2 text-[12px] leading-snug text-muted">
                  <Icon name="check" className="mt-0.5 size-3 shrink-0 text-emerald-500" />
                  {point}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <dl className="space-y-2.5 rounded-xl border border-hairline bg-slate-50/60 p-3 text-[12px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Type</dt>
            <dd className="font-medium text-ink">{draft?.type ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Difficulty</dt>
            <dd>{level ? <Chip className={level.chip}>{level.label}</Chip> : <span className="text-ink">—</span>}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Language</dt>
            <dd className="font-medium text-ink uppercase">{draft?.language ?? "—"}</dd>
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Quality</dt>
              <dd className="font-semibold text-ink tabular-nums">{quality ?? "—"}</dd>
            </div>
            <Progress
              value={quality ?? 0}
              className="mt-1.5"
              barClassName={cn(
                quality != null && quality >= 75 ? "bg-emerald-500" : quality != null && quality >= 50 ? "bg-amber-500" : "bg-rose-500",
              )}
            />
          </div>
          {typeof draft?.confidence === "number" ? (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Model confidence</dt>
              <dd className="font-medium text-ink tabular-nums">{Math.round(draft.confidence * 100)}%</dd>
            </div>
          ) : null}
          {item.analysis ? (
            <p className="border-t border-hairline pt-2.5 text-[11px] leading-snug text-slate-400">
              {item.analysis.provider} · {item.analysis.model}
              {item.analysis.latencyMs != null ? ` · ${item.analysis.latencyMs} ms` : ""}
            </p>
          ) : null}
        </dl>
      </div>

      {item.duplicateOf ? (
        <Callout tone="amber" icon="repeat" title="Possible duplicate" className="mt-4">
          Looks like{" "}
          <Link href={`/resources/${item.duplicateOf.slug}`} className="font-semibold underline underline-offset-2">
            {item.duplicateOf.title}
          </Link>
          {item.duplicateSimilarity != null
            ? ` — ${Math.round(item.duplicateSimilarity * 100)}% similar.`
            : " — already in the atlas."}
        </Callout>
      ) : null}

      {item.errorMessage ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50/70 px-4 py-3">
          <p className="min-w-0 text-[13px] text-rose-900">
            <span className="font-semibold">Pipeline failed:</span> {item.errorMessage}
          </p>
          <Button
            variant="subtle"
            size="sm"
            disabled={isPending}
            onClick={() => run(() => retrySubmissionAction(item.id))}
          >
            <Icon name="repeat" className="size-3.5" />
            Retry
          </Button>
        </div>
      ) : null}

      {item.events.length > 0 ? (
        <details className="mt-4 rounded-xl border border-hairline">
          <summary className="cursor-pointer list-none px-3 py-2 text-[12px] font-medium text-muted select-none hover:text-ink">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="git-branch" className="size-3.5" />
              Pipeline trace ({item.events.length})
            </span>
          </summary>
          <ul className="divide-y divide-hairline border-t border-hairline">
            {item.events.map((event, index) => (
              <li key={`${event.stage}-${index}`} className="flex items-center gap-3 px-3 py-2 text-[12px]">
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    event.status === "failed" ? "bg-rose-500" : event.status === "completed" ? "bg-emerald-500" : "bg-slate-300",
                  )}
                />
                <span className="w-32 shrink-0 font-medium text-ink">{event.stage}</span>
                <span className="w-20 shrink-0 text-muted">{event.status}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{event.message ?? ""}</span>
                <span className="shrink-0 text-slate-400 tabular-nums">
                  {event.durationMs != null ? `${event.durationMs} ms` : "—"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {error ? <p className="mt-3 text-[13px] font-medium text-rose-600">{error}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
        <Button size="sm" disabled={isPending} onClick={() => run(() => approveSubmissionAction(item.id))}>
          <Icon name="check" className="size-3.5" />
          Approve
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => run(() => approveSubmissionAction(item.id, { isEditorPick: true }))}
        >
          <Icon name="sparkles" className="size-3.5" />
          Approve as editor&apos;s pick
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => {
            setError(null);
            setRejecting((open) => !open);
          }}
          className="ml-auto"
        >
          <Icon name="x" className="size-3.5" />
          Reject
        </Button>
      </div>

      {rejecting ? (
        <div className="mt-3 rounded-xl border border-hairline bg-slate-50/60 p-3">
          <label htmlFor={`reason-${item.id}`} className="text-[12px] font-medium text-ink">
            Why is this being rejected? The contributor sees this.
          </label>
          <textarea
            id={`reason-${item.id}`}
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Thin content, marketing page, already covered by…"
            className="mt-2 w-full resize-y rounded-lg border border-hairline bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-slate-400 focus:border-brand-300 focus:outline-none"
          />
          <div className="mt-2 flex items-center gap-2">
            <Button
              variant="danger"
              size="sm"
              disabled={isPending || !reason.trim()}
              onClick={() => run(() => rejectSubmissionAction(item.id, reason))}
            >
              Confirm rejection
            </Button>
            <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
