import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnrollButton } from "@/components/path/enroll-button";
import { LearningStateControl } from "@/components/resource/bookmark-button";
import { OutboundLink } from "@/components/resource/outbound-link";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Callout, Chip, DifficultyMeter, IconTile, Panel, Progress, StarRating, TypeLabel } from "@/components/ui/primitives";
import { getCurrentUserId } from "@/lib/auth/session";
import { isEmbeddedDatabase } from "@/lib/db/client";
import { getPathBySlug, getPathSlugs, listPaths } from "@/lib/queries/paths";
import { accent, difficulty as difficultyStyle } from "@/lib/accents";
import { siteConfig } from "@/lib/config";
import { cn, compactNumber, formatMinutes, pluralize } from "@/lib/utils";

export const revalidate = 600;

export async function generateStaticParams() {
  // PGlite is exclusive to one process; Next runs this in a worker.
  if (isEmbeddedDatabase()) return [];
  const slugs = await getPathSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const path = await getPathBySlug(slug);
  if (!path) return { title: "Path not found" };

  return {
    title: path.title,
    description: path.subtitle ?? path.description ?? undefined,
    alternates: { canonical: `${siteConfig.url}/paths/${path.slug}` },
    openGraph: {
      title: `${path.title} — ${siteConfig.name}`,
      description: path.subtitle ?? undefined,
      type: "article",
    },
  };
}

export default async function PathDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const userId = await getCurrentUserId();
  const path = await getPathBySlug(slug, userId);
  if (!path) notFound();

  const related = (await listPaths({ category: path.category }, userId)).filter((item) => item.slug !== path.slug).slice(0, 3);
  const tone = accent(path.accent);
  const completed = path.completedCount ?? 0;
  const progress = path.progress ?? (path.resourceCount ? Math.round((completed / path.resourceCount) * 100) : 0);
  const nextResource = path.stages.flatMap((stage) => stage.resources).find((resource) => resource.bookmarkState !== "completed");

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: path.title,
    description: path.description ?? path.subtitle,
    provider: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
    educationalLevel: path.difficulty,
    numberOfCredits: path.resourceCount,
    timeRequired: path.estimatedWeeks ? `P${path.estimatedWeeks}W` : undefined,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] text-muted">
        <Link href="/paths" className="hover:text-ink">
          Learning paths
        </Link>
        <Icon name="chevron-right" className="size-3" />
        <span className="text-ink">{path.title}</span>
      </nav>

      <header className={cn("mt-4 overflow-hidden rounded-card border border-hairline bg-surface p-6 shadow-card sm:p-8")}>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <IconTile icon={path.icon} accent={path.accent} size="lg" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <TypeLabel name={path.category} accent={path.accent} />
                  {path.isPopular && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      <Icon name="flame" className="size-3" />
                      Popular
                    </span>
                  )}
                </div>
                <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-3xl">{path.title}</h1>
              </div>
            </div>

            {path.subtitle && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{path.subtitle}</p>}

            <dl className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px]">
              <Meta icon="layers" label={`${path.stageCount} ${pluralize(path.stageCount, "stage")}`} />
              <Meta icon="book-open" label={`${path.resourceCount} ${pluralize(path.resourceCount, "resource")}`} />
              {path.estimatedWeeks && <Meta icon="clock" label={`${path.estimatedWeeks} weeks at a steady pace`} />}
              {path.totalMinutes > 0 && <Meta icon="gauge" label={`${formatMinutes(path.totalMinutes)} of material`} />}
              <Meta icon="users" label={`${compactNumber(path.learnersCount)} learners`} />
              <span className="inline-flex items-center gap-2">
                <DifficultyMeter level={path.difficulty} />
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                    difficultyStyle(path.difficulty).chip,
                  )}
                >
                  {difficultyStyle(path.difficulty).label}
                </span>
              </span>
            </dl>
          </div>

          <div className="shrink-0 sm:w-56">
            <EnrollButton pathId={path.id} pathSlug={path.slug} isEnrolled={path.isEnrolled} size="lg" />
            {(path.isEnrolled || completed > 0) && (
              <div className="mt-4 rounded-xl border border-hairline p-3">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-medium text-ink">Your progress</span>
                  <span className="text-muted tabular-nums">{progress}%</span>
                </div>
                <Progress value={progress} className="mt-2" barClassName={tone.bar} />
                <p className="mt-1.5 text-[11px] text-muted">
                  {completed} of {path.resourceCount} complete
                </p>
              </div>
            )}
            {nextResource && (
              <Link
                href={`/resources/${nextResource.slug}`}
                className="mt-3 block rounded-xl border border-hairline p-3 transition hover:border-brand-200 hover:shadow-card"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Up next</p>
                <p className="mt-1 line-clamp-2 text-[13px] font-medium text-ink">{nextResource.title}</p>
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px]">
        <div className="space-y-8">
          {path.description && (
            <section>
              <h2 className="text-sm font-semibold text-ink">About this path</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{path.description}</p>
            </section>
          )}

          <ol className="space-y-6">
            {path.stages.map((stage, index) => {
              const stageComplete =
                stage.resources.length > 0 && stage.resources.every((resource) => resource.bookmarkState === "completed");
              return (
                <li key={stage.id} className="relative pl-10">
                  {index < path.stages.length - 1 && (
                    <span aria-hidden className="absolute left-[15px] top-9 bottom-[-24px] w-px bg-slate-200" />
                  )}
                  <span
                    className={cn(
                      "absolute left-0 top-0 inline-flex size-8 items-center justify-center rounded-full border text-[13px] font-semibold",
                      stageComplete ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-hairline bg-surface text-ink",
                    )}
                  >
                    {stageComplete ? <Icon name="check" className="size-4" /> : stage.position}
                  </span>

                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="text-base font-semibold tracking-[-0.01em] text-ink">{stage.title}</h3>
                    {stage.estimatedWeeks && (
                      <span className="text-[12px] text-muted">
                        {stage.estimatedWeeks} {pluralize(stage.estimatedWeeks, "week")}
                      </span>
                    )}
                  </div>
                  {stage.description && <p className="mt-1 text-[13px] leading-relaxed text-muted">{stage.description}</p>}

                  <ul className="mt-4 space-y-3">
                    {stage.resources.map((resource) => (
                      <li
                        key={resource.id}
                        className="rounded-xl border border-hairline bg-surface p-4 transition hover:shadow-card"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <TypeLabel name={resource.typeName} accent={resource.typeAccent} />
                              {resource.isOptional && <Chip>Optional</Chip>}
                              {resource.bookmarkState === "completed" && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                                  <Icon name="check-circle" className="size-3.5" />
                                  Done
                                </span>
                              )}
                            </div>
                            <h4 className="mt-1 text-[15px] font-semibold leading-snug text-ink">
                              <Link href={`/resources/${resource.slug}`} className="hover:text-brand-700">
                                {resource.title}
                              </Link>
                            </h4>
                            <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">{resource.description}</p>
                            {resource.note && (
                              <p className="mt-2 border-l-2 border-brand-200 pl-2.5 text-[12px] italic text-muted">
                                {resource.note}
                              </p>
                            )}
                            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                              {resource.authorName && <span>{resource.authorName}</span>}
                              {resource.estimatedMinutes && <span>{formatMinutes(resource.estimatedMinutes)}</span>}
                              <span className="capitalize">{resource.difficulty}</span>
                              <StarRating value={resource.communityScore} count={resource.ratingsCount} />
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <OutboundLink
                              resourceId={resource.id}
                              href={resource.url}
                              typeSlug={resource.typeSlug}
                              variant="subtle"
                              size="sm"
                              label="Open"
                            />
                            <LearningStateControl resourceId={resource.id} state={resource.bookmarkState} />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        </div>

        <aside className="space-y-5">
          {path.audience && path.audience.length > 0 && (
            <Panel className="p-5">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Who this is for</h2>
              <ul className="mt-3 space-y-2">
                {path.audience.map((item) => (
                  <li key={item} className="flex gap-2 text-[13px] leading-relaxed text-ink">
                    <Icon name="users" className="mt-0.5 size-3.5 shrink-0 text-brand-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {path.outcomes && path.outcomes.length > 0 && (
            <Panel className="p-5">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">By the end you can</h2>
              <ul className="mt-3 space-y-2">
                {path.outcomes.map((item) => (
                  <li key={item} className="flex gap-2 text-[13px] leading-relaxed text-ink">
                    <Icon name="check-circle" className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Callout tone="brand" icon="sparkles">
            Progress is shared across the atlas. Anything you have already completed counts here automatically.
          </Callout>

          {related.length > 0 && (
            <Panel className="p-5">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">More in {path.category}</h2>
              <ul className="mt-3 space-y-3">
                {related.map((item) => (
                  <li key={item.id}>
                    <Link href={`/paths/${item.slug}`} className="group flex items-start gap-2.5">
                      <IconTile icon={item.icon} accent={item.accent} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-ink group-hover:text-brand-700">
                          {item.title}
                        </span>
                        <span className="block text-[11px] text-muted">
                          {item.resourceCount} resources · {item.estimatedWeeks} weeks
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <ButtonLink href="/paths" variant="outline" size="sm" className="w-full justify-center">
            All learning paths
          </ButtonLink>
        </aside>
      </div>
    </div>
  );
}

function Meta({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted">
      <Icon name={icon} className="size-3.5" />
      {label}
    </span>
  );
}
