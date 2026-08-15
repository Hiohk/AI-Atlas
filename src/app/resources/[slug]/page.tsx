import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LearningStateControl } from "@/components/resource/bookmark-button";
import { ResourceTabs } from "@/components/resource/resource-tabs";
import { OutboundLink } from "@/components/resource/outbound-link";
import { ResourceShareActions } from "@/components/resource/share-actions";
import { Icon } from "@/components/ui/icon";
import {
  Avatar,
  Callout,
  Card,
  Chip,
  DifficultyMeter,
  Panel,
  StarRating,
  TopicChip,
  TypeLabel,
} from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth/session";
import { track } from "@/lib/analytics/track";
import { difficulty as difficultyStyle } from "@/lib/accents";
import { siteConfig } from "@/lib/config";
import { getDictionary } from "@/lib/i18n";
import { formatMessage } from "@/lib/i18n/dictionary";
import {
  getRelatedByRelation,
  getResourceAudience,
  getResourceBySlug,
  getResourceReviews,
  getSimilarResources,
} from "@/lib/queries/resources";
import { cn, compactNumber, formatDate, formatMinutes } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resource = await getResourceBySlug((await params).slug);
  if (!resource) return { title: "Resource not found" };

  return {
    title: resource.title,
    description: resource.description,
    alternates: { canonical: `/resources/${resource.slug}` },
    openGraph: {
      title: resource.title,
      description: resource.description,
      type: "article",
      publishedTime: resource.publishedAt ?? undefined,
      authors: resource.authorName ? [resource.authorName] : undefined,
    },
  };
}

export default async function ResourceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [user, dict] = await Promise.all([getCurrentUser(), getDictionary()]);
  const resource = await getResourceBySlug(slug, user?.id);
  if (!resource) notFound();

  const [before, next, explains, similar, reviews, audience] = await Promise.all([
    getRelatedByRelation(resource.id, "prerequisite_of", "incoming"),
    getRelatedByRelation(resource.id, "next_step", "outgoing"),
    getRelatedByRelation(resource.id, "explains", "incoming"),
    getSimilarResources(resource.id, 6),
    getResourceReviews(resource.id),
    getResourceAudience(resource.id),
  ]);

  void track("resource_view", { userId: user?.id, resourceId: resource.id });

  const level = difficultyStyle(resource.difficulty);
  const meta = resource.metadata ?? {};
  const readingTime = formatMinutes(resource.estimatedMinutes);
  const communityQuote = meta.communityQuote as { body: string; author: string } | undefined;

  const infoRows: Array<{ label: string; value: React.ReactNode }> = [
    { label: dict.resourceDetail.type, value: resource.typeName },
    ...(meta.year ? [{ label: dict.resourceDetail.year, value: String(meta.year) }] : []),
    ...(meta.conference ? [{ label: dict.resourceDetail.conference, value: String(meta.conference) }] : []),
    ...(meta.provider ? [{ label: dict.resourceDetail.provider, value: String(meta.provider) }] : []),
    ...(meta.lessons ? [{ label: dict.resourceDetail.lessons, value: String(meta.lessons) }] : []),
    ...(meta.pages ? [{ label: dict.resourceDetail.pages, value: String(meta.pages) }] : []),
    ...(typeof meta.stars === "number" ? [{ label: dict.resourceDetail.stars, value: compactNumber(meta.stars as number) }] : []),
    ...(meta.pdfUrl
      ? [{ label: dict.resourceDetail.pdf, value: <ExternalValue href={String(meta.pdfUrl)} label={hostOf(String(meta.pdfUrl))} /> }]
      : []),
    ...(meta.codeUrl
      ? [{ label: dict.resourceDetail.code, value: <ExternalValue href={String(meta.codeUrl)} label={hostOf(String(meta.codeUrl))} /> }]
      : []),
    ...(meta.license ? [{ label: dict.resourceDetail.license, value: String(meta.license) }] : []),
    { label: dict.resourceDetail.language, value: resource.language === "zh" ? "中文" : "English" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        // Structured data makes these pages eligible for rich results, which is
        // the main organic growth channel for a directory.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": resource.typeSlug === "course" ? "Course" : resource.typeSlug === "paper" ? "ScholarlyArticle" : "CreativeWork",
            name: resource.title,
            description: resource.description,
            url: `${siteConfig.url}/resources/${resource.slug}`,
            sameAs: resource.url,
            ...(resource.authorName ? { author: { "@type": "Person", name: resource.authorName } } : {}),
            ...(resource.organizationName ? { publisher: { "@type": "Organization", name: resource.organizationName } } : {}),
            ...(resource.publishedAt ? { datePublished: resource.publishedAt } : {}),
            ...(resource.communityScore && resource.ratingsCount
              ? {
                  aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: resource.communityScore,
                    ratingCount: resource.ratingsCount,
                    bestRating: 5,
                  },
                }
              : {}),
          }),
        }}
      />

      <nav className="flex items-center gap-1.5 text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/explore" className="hover:text-brand-600">
            {dict.nav.explore}
        </Link>
        {resource.topics[0] ? (
          <>
            <Icon name="chevron-right" className="size-3 text-slate-300" />
            <Link href={`/topics/${resource.topics[0].slug}`} className="hover:text-brand-600">
              {resource.topics[0].name}
            </Link>
          </>
        ) : null}
        <Icon name="chevron-right" className="size-3 text-slate-300" />
        <span className="truncate font-medium text-ink">{resource.title}</span>
      </nav>

      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_19rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-md px-1.5 py-0.5 ring-1 ring-inset", level.chip)}>
              <TypeLabel name={resource.typeName} accent={resource.typeAccent} />
            </span>
            {resource.publishedAt ? (
              <span className="text-xs text-muted">
                Published{meta.conference ? ` in ${meta.conference}` : ""} {new Date(resource.publishedAt).getFullYear()}
              </span>
            ) : null}
            {resource.isEditorPick ? (
              <Chip className="bg-brand-50 text-brand-700 ring-brand-100">
                <Icon name="sparkles" className="size-2.5" />
                {dict.resourceDetail.editorPick}
              </Chip>
            ) : null}
            {resource.isOfficial ? (
              <Chip className="bg-sky-50 text-sky-700 ring-sky-100">
                <Icon name="shield-check" className="size-2.5" />
                {dict.resourceDetail.official}
              </Chip>
            ) : null}
          </div>

          <h1 className="mt-3 text-[26px] leading-[1.15] font-semibold tracking-[-0.025em] text-ink sm:text-[32px]">
            {resource.title}
          </h1>

          {resource.authorName || resource.organizationName ? (
            <p className="mt-2.5 text-sm text-muted">
              {[resource.authorName, resource.organizationName].filter(Boolean).join(" · ")}
            </p>
          ) : null}

          <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
            <StarRating value={resource.communityScore} count={resource.ratingsCount || undefined} />
            <span className="flex items-center gap-1">
              <Icon name="bookmark" className="size-3.5" />
              {compactNumber(resource.savesCount)} {dict.resourceDetail.saves}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="eye" className="size-3.5" />
              {compactNumber(resource.viewsCount)} {dict.resourceDetail.views}
            </span>
            {readingTime ? (
              <span className="flex items-center gap-1">
                <Icon name="clock" className="size-3.5" />
                {readingTime}
              </span>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {resource.topics.map((topic) => (
              <TopicChip key={topic.slug} slug={topic.slug} name={topic.name} size="md" />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <OutboundLink resourceId={resource.id} href={resource.url} typeSlug={resource.typeSlug} />
            <LearningStateControl resourceId={resource.id} state={resource.bookmarkState} />
            <ResourceShareActions
              title={resource.title}
              slug={resource.slug}
              authors={resource.authorName}
              year={typeof meta.year === "number" ? meta.year : resource.publishedAt ? new Date(resource.publishedAt).getFullYear() : null}
              sourceUrl={resource.url}
            />
          </div>

          <div className="mt-8">
            <ResourceTabs
              resource={resource}
              reviews={reviews}
              audience={audience}
              similar={similar}
              currentUserId={user?.id ?? null}
            />
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Panel className="p-4">
            <p className="mb-3 text-[11px] font-semibold tracking-[0.12em] text-ink uppercase">{dict.resourceDetail.info}</p>
            <dl className="space-y-2 text-[13px]">
              {infoRows.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0 text-muted">{row.label}</dt>
                  <dd className="truncate text-right font-medium text-ink">{row.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 border-t border-hairline pt-3">
              <p className="mb-2 flex items-center justify-between text-[11px] font-semibold tracking-[0.12em] text-ink uppercase">
                {dict.resourceDetail.qualityScore}
                <span className="text-brand-600">{Math.round(resource.qualityScore)}/100</span>
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${resource.qualityScore}%` }} />
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">
                {dict.resourceDetail.qualityBody}
              </p>
            </div>
          </Panel>

          {before.length > 0 ? (
            <GraphPanel title={dict.resourceDetail.before} icon="arrow-left" items={before} />
          ) : null}
          {next.length > 0 ? <GraphPanel title={dict.resourceDetail.next} icon="arrow-right" items={next} /> : null}
          {explains.length > 0 ? <GraphPanel title={dict.resourceDetail.explainers} icon="message-square" items={explains} /> : null}

          {resource.topics.length > 0 ? (
            <Panel className="p-4">
              <p className="mb-2.5 text-[11px] font-semibold tracking-[0.12em] text-ink uppercase">{dict.resourceDetail.relatedTopics}</p>
              <div className="flex flex-wrap gap-1.5">
                {resource.topics.map((topic) => (
                  <TopicChip key={topic.slug} slug={topic.slug} name={topic.name} />
                ))}
              </div>
            </Panel>
          ) : null}

          {communityQuote ? (
            <Panel className="p-4">
              <p className="mb-2.5 text-[11px] font-semibold tracking-[0.12em] text-ink uppercase">{dict.resourceDetail.communityHighlight}</p>
              <blockquote className="text-[13px] leading-relaxed text-ink italic">“{communityQuote.body}”</blockquote>
              <p className="mt-2 text-[11px] text-muted">— {communityQuote.author}</p>
            </Panel>
          ) : null}

          {audience.pathsIncluding.length > 0 ? (
            <Panel className="p-4">
              <p className="mb-2.5 text-[11px] font-semibold tracking-[0.12em] text-ink uppercase">{dict.resourceDetail.partOfPaths}</p>
              <div className="space-y-1.5">
                {audience.pathsIncluding.map((path) => (
                  <Link
                    key={path.slug}
                    href={`/paths/${path.slug}`}
                    className="flex items-start gap-2 rounded-lg p-1.5 text-[13px] hover:bg-hover"
                  >
                    <Icon name={path.icon} className="mt-0.5 size-3.5 text-brand-600" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{path.title}</span>
                      <span className="block truncate text-[11px] text-muted">{path.stageTitle}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </Panel>
          ) : null}

          <Panel className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-ink uppercase">{dict.filters.difficulty}</p>
              <span className="text-[13px] font-medium text-ink">{level.label}</span>
            </div>
            <DifficultyMeter level={resource.difficulty} className="mt-2" />
            {resource.bestFor?.length ? (
              <>
                <p className="mt-4 mb-2 text-[11px] font-semibold tracking-[0.12em] text-ink uppercase">{dict.resourceDetail.bestFor}</p>
                <div className="flex flex-wrap gap-1.5">
                  {resource.bestFor.map((audienceName) => (
                    <Chip key={audienceName}>
                      <Icon name="users" className="size-2.5" />
                      {audienceName}
                    </Chip>
                  ))}
                </div>
              </>
            ) : null}
          </Panel>

          {resource.submitter ? (
            <Card className="flex items-center gap-2.5 p-3">
              <Avatar src={resource.submitter.avatarUrl} name={resource.submitter.displayName} size={32} />
              <div className="min-w-0 text-[12px]">
                <p className="truncate font-medium text-ink">{formatMessage(dict.resourceDetail.curatedBy, { name: resource.submitter.displayName })}</p>
                <p className="text-muted">
                  {resource.lastCheckedAt
                    ? formatMessage(dict.resourceDetail.linkChecked, { date: formatDate(resource.lastCheckedAt) ?? "" })
                    : dict.resourceDetail.reviewedByEditor}
                </p>
              </div>
            </Card>
          ) : null}

          <Callout tone="brand" icon="flame" title={dict.resourceDetail.trendingScore} className="text-[12px]">
            {formatMessage(dict.resourceDetail.trendingBody, { score: Math.round(resource.trendingScore) })}
          </Callout>
        </aside>
      </div>
    </div>
  );
}

function GraphPanel({
  title,
  icon,
  items,
}: {
  title: string;
  icon: string;
  items: Array<{ slug: string; title: string; typeName: string; typeAccent: string; typeIcon: string }>;
}) {
  return (
    <Panel className="p-4">
      <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-ink uppercase">
        <Icon name={icon} className="size-3.5 text-brand-600" />
        {title}
      </p>
      <div className="space-y-1">
        {items.map((item) => (
          <Link
            key={item.slug}
            href={`/resources/${item.slug}`}
            className="flex items-start gap-2 rounded-lg p-1.5 text-[13px] transition-colors hover:bg-hover"
          >
            <Icon name={item.typeIcon} className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
            <span className="min-w-0 flex-1 leading-snug text-ink">{item.title}</span>
          </Link>
        ))}
      </div>
    </Panel>
  );
}

function ExternalValue({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700"
    >
      <span className="max-w-32 truncate">{label}</span>
      <Icon name="arrow-up-right" className="size-3" />
    </a>
  );
}

function hostOf(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.length > 1 ? parsed.pathname : ""}`;
  } catch {
    return url;
  }
}
