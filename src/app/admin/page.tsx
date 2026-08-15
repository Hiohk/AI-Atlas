import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";
import { Avatar, Card, Chip, EmptyState, IconTile, Panel, SectionHeading } from "@/components/ui/primitives";
import {
  getAdminOverview,
  getPipelineFunnel,
  getSearchInsights,
  listReviewQueue,
  listUsers,
} from "@/lib/queries/admin";
import { getTopicGaps } from "@/lib/queries/trending";
import { cn, compactNumber, formatDate, relativeTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Overview",
};

const STAGE_LABELS: Record<string, string> = {
  submitted: "Submitted",
  fetching: "Fetching",
  analyzing: "Analyzing",
  duplicate_check: "Duplicate check",
  ready_for_review: "Ready for review",
  approved: "Approved",
  published: "Published",
  rejected: "Rejected",
  failed: "Failed",
};

const RISK_CHIPS: Record<string, string> = {
  high: "bg-rose-50 text-rose-700 ring-rose-100",
  medium: "bg-amber-50 text-amber-700 ring-amber-100",
  low: "bg-emerald-50 text-emerald-700 ring-emerald-100",
};

export default async function AdminOverviewPage() {
  const [overview, funnel, insights, gaps, queue, members] = await Promise.all([
    getAdminOverview(),
    getPipelineFunnel(),
    getSearchInsights(8),
    getTopicGaps(6),
    listReviewQueue({ status: "ready_for_review", limit: 5 }),
    listUsers(6),
  ]);

  const kpis: Array<{
    label: string;
    value: number;
    suffix?: string;
    subtitle: string;
    icon: IconName;
    accent: string;
    href?: string;
  }> = [
    {
      label: "Awaiting review",
      value: overview.awaitingReview,
      subtitle: `${overview.highRisk} flagged high risk`,
      icon: "list-checks",
      accent: "amber",
      href: "/admin/review?status=ready_for_review",
    },
    {
      label: "In pipeline",
      value: overview.inPipeline,
      subtitle: "Fetching, analysing or de-duping",
      icon: "activity",
      accent: "indigo",
      href: "/admin/review?status=active",
    },
    {
      label: "Published this week",
      value: overview.publishedThisWeek,
      subtitle: `${compactNumber(overview.publishedTotal)} in the atlas`,
      icon: "check-circle",
      accent: "emerald",
      href: "/admin/resources?status=published",
    },
    {
      label: "Average quality",
      value: overview.avgQuality,
      suffix: "/100",
      subtitle: `${overview.submissionsThisWeek} submissions this week`,
      icon: "gauge",
      accent: "violet",
    },
    {
      label: "Open reports",
      value: overview.openReports,
      subtitle: "Broken links and content flags",
      icon: "shield",
      accent: "slate",
    },
    {
      label: "Failed",
      value: overview.failed,
      subtitle: "Pipeline errors waiting on a retry",
      icon: "x",
      accent: "rose",
      href: "/admin/review?status=failed",
    },
  ];

  const funnelMax = Math.max(1, ...funnel.map((stage) => stage.count));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">Editorial overview</h1>
        <p className="mt-1 text-sm text-muted">
          Where the ingestion pipeline stands right now, and what the community is asking for.
        </p>
      </header>

      <section>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((kpi) => {
            const body = (
              <Card
                className={cn(
                  "flex h-full items-start gap-3 p-4",
                  kpi.href && "transition-shadow hover:shadow-lift",
                )}
              >
                <IconTile icon={kpi.icon} accent={kpi.accent} size="sm" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">{kpi.label}</p>
                  <p className="mt-1 text-2xl leading-none font-semibold tracking-[-0.02em] text-ink tabular-nums">
                    {compactNumber(kpi.value)}
                    {kpi.suffix ? <span className="text-sm font-medium text-muted">{kpi.suffix}</span> : null}
                  </p>
                  <p className="mt-1.5 text-[12px] leading-snug text-muted">{kpi.subtitle}</p>
                </div>
                {kpi.href ? <Icon name="chevron-right" className="ml-auto size-4 shrink-0 text-slate-300" /> : null}
              </Card>
            );
            return kpi.href ? (
              <Link key={kpi.label} href={kpi.href} className="block">
                {body}
              </Link>
            ) : (
              <div key={kpi.label}>{body}</div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel className="p-5">
          <SectionHeading eyebrow="Pipeline" eyebrowIcon="git-branch" title="Submissions by stage" />
          {funnel.length === 0 ? (
            <EmptyState className="mt-4" icon="git-branch" title="Nothing has been submitted yet" />
          ) : (
            <ul className="mt-4 space-y-2.5">
              {funnel.map((stage) => (
                <li key={stage.status} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-[13px] text-muted">
                    {STAGE_LABELS[stage.status] ?? stage.status}
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        stage.status === "failed" || stage.status === "rejected"
                          ? "bg-rose-400"
                          : stage.status === "ready_for_review"
                            ? "bg-amber-400"
                            : stage.status === "published"
                              ? "bg-emerald-500"
                              : "bg-brand-500",
                      )}
                      style={{ width: `${Math.max(2, (stage.count / funnelMax) * 100)}%` }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right text-[13px] font-semibold text-ink tabular-nums">
                    {stage.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="p-5">
          <SectionHeading
            eyebrow="Needs your attention"
            eyebrowIcon="flame"
            title="Top of the review queue"
            action={
              <Link href="/admin/review" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                Open queue
              </Link>
            }
          />
          {queue.length === 0 ? (
            <EmptyState
              className="mt-4"
              icon="check-circle"
              title="Queue is clear"
              description="Nothing is waiting on a reviewer right now."
            />
          ) : (
            <ul className="mt-4 divide-y divide-hairline">
              {queue.map((item) => (
                <li key={item.id}>
                  <Link href="/admin/review" className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-hover">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">
                        {item.draft?.title ?? item.url}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                        <Chip className={RISK_CHIPS[item.riskLevel] ?? RISK_CHIPS.low}>{item.riskLevel} risk</Chip>
                        {item.submitter ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Avatar src={item.submitter.avatarUrl} name={item.submitter.displayName} size={16} />
                            {item.submitter.displayName}
                          </span>
                        ) : (
                          <span>Anonymous</span>
                        )}
                        <span>· {relativeTime(item.createdAt)}</span>
                      </span>
                    </span>
                    {typeof item.draft?.qualityScore === "number" ? (
                      <span className="shrink-0 text-[13px] font-semibold text-ink tabular-nums">
                        {Math.round(item.draft.qualityScore)}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      <section>
        <Panel className="p-5">
          <SectionHeading
            eyebrow="Demand"
            eyebrowIcon="search"
            title="What people search for"
            description="Last 30 days. Rows with few results are where the atlas is thin."
          />
          {insights.length === 0 ? (
            <EmptyState className="mt-4" title="No searches recorded yet" />
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-[13px]">
                <thead>
                  <tr className="border-b border-hairline text-left text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                    <th scope="col" className="py-2 pr-3 font-semibold">
                      Query
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">
                      Searches
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">
                      Avg results
                    </th>
                    <th scope="col" className="py-2 text-right font-semibold">
                      Click-through
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {insights.map((row) => {
                    const thin = row.avgResults <= 6;
                    return (
                      <tr key={row.query} className="hover:bg-hover/70">
                        <td className="py-2 pr-3">
                          <span className="flex items-center gap-2">
                            <span className="truncate font-medium text-ink">{row.query}</span>
                            {thin ? (
                              <Chip className="bg-amber-50 text-amber-700 ring-amber-100">Content gap</Chip>
                            ) : null}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right text-muted tabular-nums">{compactNumber(row.searches)}</td>
                        <td
                          className={cn(
                            "py-2 pr-3 text-right tabular-nums",
                            thin ? "font-semibold text-amber-700" : "text-muted",
                          )}
                        >
                          {row.avgResults}
                        </td>
                        <td className="py-2 text-right text-muted tabular-nums">{row.clickThrough}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Panel className="p-5">
          <SectionHeading
            eyebrow="Backlog"
            eyebrowIcon="compass"
            title="Content gaps"
            description="High search demand, thin coverage — the shortlist for the next curation round."
          />
          {gaps.length === 0 ? (
            <EmptyState className="mt-4" icon="compass" title="No gaps detected" description="Every popular query returns a healthy set of results." />
          ) : (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {gaps.map((gap) => (
                <li
                  key={gap.query}
                  className="flex items-center justify-between gap-3 rounded-xl border border-hairline px-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-ink">{gap.query}</span>
                    <span className="text-[11px] text-muted tabular-nums">
                      {gap.results} {gap.results === 1 ? "result" : "results"}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold text-brand-600 tabular-nums">
                    {compactNumber(gap.searches)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="p-5">
          <SectionHeading eyebrow="Community" eyebrowIcon="users" title="Recent members" />
          {members.length === 0 ? (
            <EmptyState className="mt-4" icon="users" title="No members yet" />
          ) : (
            <ul className="mt-4 space-y-3">
              {members.map((member) => (
                <li key={member.id} className="flex items-center gap-2.5">
                  <Avatar src={member.avatarUrl} name={member.displayName} size={30} />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[13px] font-medium text-ink">{member.displayName}</span>
                    <span className="block truncate text-[11px] text-muted">
                      @{member.username} · joined {formatDate(member.createdAt)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[13px] font-semibold text-ink tabular-nums">{member.submissions}</span>
                    <span className="block text-[10px] text-muted">subs</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>
    </div>
  );
}
