import type { Metadata } from "next";
import Link from "next/link";
import { ReviewCard } from "@/components/admin/review-card";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { EmptyState, Panel } from "@/components/ui/primitives";
import { getPipelineFunnel, listReviewQueue } from "@/lib/queries/admin";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Review queue",
};

const FILTERS = [
  { value: "ready_for_review", label: "Ready for review" },
  { value: "active", label: "In pipeline" },
  { value: "failed", label: "Failed" },
  { value: "rejected", label: "Rejected" },
  { value: "published", label: "Published" },
  { value: "all", label: "All" },
] as const;

const ACTIVE_STAGES = ["submitted", "fetching", "analyzing", "duplicate_check", "ready_for_review"];

const CHECKLIST = [
  "Is it accurate and still current — has the framework or model it describes moved on?",
  "Is the depth right for the difficulty the analyser assigned?",
  "Do the topics place it correctly in the map, not just adjacent to it?",
  "Is it genuinely additive next to anything flagged as a duplicate?",
];

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = FILTERS.some((filter) => filter.value === requested) ? requested! : "ready_for_review";

  const [funnel, queue] = await Promise.all([getPipelineFunnel(), listReviewQueue({ status, limit: 30 })]);

  const byStatus = new Map(funnel.map((stage) => [stage.status, stage.count]));
  const total = funnel.reduce((sum, stage) => sum + stage.count, 0);

  function countFor(value: string): number {
    if (value === "all") return total;
    if (value === "active") return ACTIVE_STAGES.reduce((sum, stage) => sum + (byStatus.get(stage) ?? 0), 0);
    return byStatus.get(value) ?? 0;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">Review queue</h1>
        <p className="mt-1 text-sm text-muted">
          Each item is a draft written by the ingestion pipeline. Approving publishes it to the atlas immediately.
        </p>
      </header>

      <Panel className="bg-brand-50/40 p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-brand-600 uppercase">
          <Icon name="list-checks" className="size-3.5" />
          What to check
        </p>
        <ul className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
          {CHECKLIST.map((point) => (
            <li key={point} className="flex items-start gap-2 text-[13px] leading-snug text-muted">
              <Icon name="check" className="mt-0.5 size-3.5 shrink-0 text-brand-500" />
              {point}
            </li>
          ))}
        </ul>
      </Panel>

      <nav aria-label="Queue filters" className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {FILTERS.map((filter) => {
          const active = filter.value === status;
          return (
            <Link
              key={filter.value}
              href={`/admin/review?status=${filter.value}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                active
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-hairline bg-surface text-muted hover:border-brand-200 hover:text-ink",
              )}
            >
              {filter.label}
              <span className={cn("tabular-nums", active ? "text-white/70" : "text-slate-400")}>
                {countFor(filter.value)}
              </span>
            </Link>
          );
        })}
      </nav>

      {queue.length === 0 ? (
        <EmptyState
          icon="check-circle"
          title="Queue is clear"
          description="Nothing matches this filter. Good time to look at the content gaps on the overview."
          action={
            <ButtonLink href="/admin" variant="subtle" size="sm">
              Back to overview
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-3">
          {queue.map((item) => (
            <ReviewCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
