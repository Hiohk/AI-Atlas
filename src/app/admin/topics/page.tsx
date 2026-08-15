import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Callout, Chip, EmptyState, IconTile, Panel } from "@/components/ui/primitives";
import { accent } from "@/lib/accents";
import { listManagedTopics } from "@/lib/queries/admin";
import { cn, compactNumber, pluralize } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Topics",
};

export default async function AdminTopicsPage() {
  const topics = await listManagedTopics();

  const parents = topics.filter((topic) => topic.parentName === null);
  const orphans = topics.filter(
    (topic) => topic.parentName !== null && !parents.some((parent) => parent.name === topic.parentName),
  );
  const totalResources = topics.reduce((sum, topic) => sum + topic.resourceCount, 0);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">Topic taxonomy</h1>
        <p className="mt-1 text-sm text-muted">
          {parents.length} top-level topics · {topics.length} total ·{" "}
          {compactNumber(totalResources)} topic assignments across the atlas.
        </p>
      </header>

      <Callout tone="brand" icon="shield" title="Read-only in this build">
        The taxonomy is seeded and versioned with the schema. Editing topics, reparenting them and merging duplicates
        happen in the database migration, not here.
      </Callout>

      {topics.length === 0 ? (
        <EmptyState
          icon="compass"
          title="No topics yet"
          description="Run the seed to load the starter taxonomy."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {parents.map((parent) => {
            const children = topics.filter((topic) => topic.parentName === parent.name);
            return (
              <Panel key={parent.slug} className="flex flex-col p-4">
                <div className="flex items-start gap-3">
                  <IconTile icon={parent.icon} accent={parent.accent} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/topics/${parent.slug}`}
                        className="text-[15px] font-semibold tracking-[-0.01em] text-ink hover:text-brand-700"
                      >
                        {parent.name}
                      </Link>
                      {parent.isFeatured ? (
                        <Chip className="bg-brand-50 text-brand-700 ring-brand-100">
                          <Icon name="star" className="size-2.5" />
                          Featured
                        </Chip>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {pluralize(parent.resourceCount, "resource")} ·{" "}
                      {children.length === 0 ? "no subtopics" : pluralize(children.length, "subtopic")}
                    </p>
                  </div>
                </div>

                {children.length > 0 ? (
                  <ul className="mt-3 divide-y divide-hairline border-t border-hairline">
                    {children.map((child) => (
                      <li key={child.slug}>
                        <Link
                          href={`/topics/${child.slug}`}
                          className="-mx-2 flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-hover"
                        >
                          <Icon
                            name={child.icon}
                            className={cn("size-3.5 shrink-0", accent(child.accent).text)}
                            strokeWidth={1.8}
                          />
                          <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{child.name}</span>
                          {child.isFeatured ? (
                            <Chip className="bg-brand-50 text-brand-700 ring-brand-100">Featured</Chip>
                          ) : null}
                          <span className="shrink-0 text-[12px] text-muted tabular-nums">{child.resourceCount}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Panel>
            );
          })}
        </div>
      )}

      {orphans.length > 0 ? (
        <Panel className="p-4">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-amber-600 uppercase">Unparented topics</p>
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {orphans.map((topic) => (
              <li key={topic.slug}>
                <Link
                  href={`/topics/${topic.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1 text-[13px] text-muted hover:border-brand-200 hover:text-ink"
                >
                  {topic.name}
                  <span className="text-[11px] text-slate-400 tabular-nums">{topic.resourceCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
