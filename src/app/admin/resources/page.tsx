import type { Metadata } from "next";
import Link from "next/link";
import { ResourceActions } from "@/components/admin/resource-actions";
import { Button } from "@/components/ui/button";
import { Chip, EmptyState, Panel, TypeLabel } from "@/components/ui/primitives";
import { difficulty as difficultyStyle } from "@/lib/accents";
import { listManagedResources } from "@/lib/queries/admin";
import { cn, compactNumber, formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Resources",
};

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "review", label: "In review" },
  { value: "archived", label: "Archived" },
] as const;

const STATUS_CHIPS: Record<string, string> = {
  published: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  review: "bg-amber-50 text-amber-700 ring-amber-100",
  archived: "bg-slate-100 text-slate-700 ring-slate-200",
};

export default async function AdminResourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = (Array.isArray(params.q) ? params.q[0] : params.q) ?? "";
  const requested = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = STATUS_FILTERS.some((filter) => filter.value === requested) ? requested! : "all";

  const resources = await listManagedResources({ q: q || undefined, status, limit: 40 });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">Resources</h1>
          <p className="mt-1 text-sm text-muted">
            The 40 most recent matches. Status changes and editor&apos;s picks take effect immediately.
          </p>
        </div>

        <form action="/admin/resources" method="get" className="flex items-center gap-2">
          {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search titles…"
            aria-label="Search resources by title"
            className="h-9 w-56 rounded-lg border border-hairline bg-surface px-3 text-[13px] text-ink placeholder:text-slate-400 focus:border-brand-300 focus:outline-none"
          />
          <Button type="submit" variant="subtle" size="sm">
            Search
          </Button>
        </form>
      </header>

      <nav aria-label="Status filters" className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((filter) => {
          const active = filter.value === status;
          const href = `/admin/resources?status=${filter.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
          return (
            <Link
              key={filter.value}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                active
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-hairline bg-surface text-muted hover:border-brand-200 hover:text-ink",
              )}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      {resources.length === 0 ? (
        <EmptyState
          icon="search"
          title="No resources match"
          description={q ? `Nothing published under "${q}" with this status.` : "Nothing carries this status yet."}
        />
      ) : (
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[62rem] text-[13px]">
              <thead>
                <tr className="border-b border-hairline bg-slate-50/70 text-left text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Title
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Type
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Topic
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Level
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                    Quality
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                    Views
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                    Saves
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Created
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {resources.map((resource) => {
                  const level = difficultyStyle(resource.difficulty);
                  return (
                    <tr key={resource.id} className="hover:bg-hover/70">
                      <td className="max-w-[22rem] px-4 py-2.5">
                        <Link
                          href={`/resources/${resource.slug}`}
                          className="block truncate font-medium text-ink hover:text-brand-700"
                        >
                          {resource.title}
                        </Link>
                        <span className="mt-1 flex items-center gap-1.5">
                          <Chip className={STATUS_CHIPS[resource.status] ?? "bg-slate-100 text-slate-700 ring-slate-200"}>
                            {resource.status}
                          </Chip>
                          {resource.isEditorPick ? (
                            <Chip className="bg-brand-50 text-brand-700 ring-brand-100">Pick</Chip>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <TypeLabel name={resource.typeName} accent={resource.typeAccent} />
                      </td>
                      <td className="max-w-[10rem] truncate px-3 py-2.5 text-muted">{resource.primaryTopic ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        <Chip className={level.chip}>{level.label}</Chip>
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-ink tabular-nums">
                        {Math.round(resource.qualityScore)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted tabular-nums">
                        {compactNumber(resource.viewsCount)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted tabular-nums">
                        {compactNumber(resource.savesCount)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-muted">{formatDate(resource.createdAt)}</td>
                      <td className="px-4 py-2.5">
                        <ResourceActions
                          resourceId={resource.id}
                          status={resource.status}
                          isEditorPick={resource.isEditorPick}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
