"use client";

import Link from "next/link";
import { BookmarkButton } from "@/components/resource/bookmark-button";
import { useDictionary, useLocale } from "@/components/providers/preferences-provider";
import { Icon } from "@/components/ui/icon";
import { Card, Chip, StarRating, TopicChip, TypeLabel } from "@/components/ui/primitives";
import { accent, difficulty as difficultyStyle } from "@/lib/accents";
import type { ResourceListItem } from "@/lib/queries/types";
import { cn, compactNumber, formatMinutes } from "@/lib/utils";

function year(resource: ResourceListItem): string | null {
  const metaYear = resource.metadata?.year;
  if (typeof metaYear === "number") return String(metaYear);
  return resource.publishedAt ? new Date(resource.publishedAt).getFullYear().toString() : null;
}

function typeLabel(slug: string, fallback: string, dict: ReturnType<typeof useDictionary>) {
  return dict.types[slug as keyof typeof dict.types] ?? fallback;
}

/** Grid card, used for editor's picks and any responsive resource grid. */
export function ResourceCard({ resource, className }: { resource: ResourceListItem; className?: string }) {
  const dict = useDictionary();
  const published = year(resource);

  return (
    <Card className={cn("group flex flex-col p-4 transition-shadow hover:shadow-lift", className)}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <TypeLabel name={typeLabel(resource.typeSlug, resource.typeName, dict)} accent={resource.typeAccent} />
        <BookmarkButton resourceId={resource.id} state={resource.bookmarkState} size="sm" className="-mt-1 -mr-1" />
      </div>

      <h3 className="text-[15px] leading-snug font-semibold tracking-[-0.01em] text-ink">
        <Link href={`/resources/${resource.slug}`} className="hover:text-brand-700">
          <span className="line-clamp-2">{resource.title}</span>
        </Link>
      </h3>

      {resource.authorName || resource.organizationName ? (
        <p className="mt-1 truncate text-xs text-muted">{resource.authorName ?? resource.organizationName}</p>
      ) : null}

      <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-muted">{resource.description}</p>

      <div className="mt-3 flex flex-wrap gap-1">
        {resource.topics.slice(0, 3).map((topic) => (
          <TopicChip key={topic.slug} slug={topic.slug} name={topic.name} />
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-3.5 text-[11px] text-muted">
        <div className="flex items-center gap-2.5">
          <StarRating value={resource.communityScore} />
          <span className="flex items-center gap-1">
            <Icon name="bookmark" className="size-3" />
            {compactNumber(resource.savesCount)}
          </span>
        </div>
        {published ? <span className="font-medium">{published}</span> : null}
      </div>
    </Card>
  );
}

/** Dense horizontal row, used on topic pages and the resource browser. */
export function ResourceRow({ resource, showThumbnail = true }: { resource: ResourceListItem; showThumbnail?: boolean }) {
  const dict = useDictionary();
  const locale = useLocale();
  const published = year(resource);
  const level = difficultyStyle(resource.difficulty);
  const stars = typeof resource.metadata?.stars === "number" ? (resource.metadata.stars as number) : null;
  const duration = formatMinutes(resource.estimatedMinutes, locale);

  return (
    <Card className="group flex gap-4 p-4 transition-shadow hover:shadow-lift">
      {showThumbnail ? (
        <Link
          href={`/resources/${resource.slug}`}
          className={cn(
            "hidden aspect-4/3 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg sm:flex",
            accent(resource.typeAccent).tile,
          )}
        >
          {resource.thumbnailUrl ? (
            // Thumbnails come from arbitrary third-party hosts.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resource.thumbnailUrl} alt="" className="size-full object-cover" loading="lazy" />
          ) : (
            <Icon name={resource.typeIcon} className="size-7 opacity-80" strokeWidth={1.6} />
          )}
        </Link>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <TypeLabel name={typeLabel(resource.typeSlug, resource.typeName, dict)} accent={resource.typeAccent} />
          {published ? <span className="text-[11px] text-muted">· {published}</span> : null}
          {stars ? (
            <span className="flex items-center gap-1 text-[11px] text-muted">
              · <Icon name="star" className="size-3" /> {compactNumber(stars)}
            </span>
          ) : null}
          {duration ? <span className="text-[11px] text-muted">· {duration}</span> : null}
          {resource.isEditorPick ? (
            <Chip className="bg-brand-50 text-brand-700 ring-brand-100">
              <Icon name="sparkles" className="size-2.5" />
              Editor&apos;s pick
            </Chip>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            <BookmarkButton resourceId={resource.id} state={resource.bookmarkState} size="sm" />
          </div>
        </div>

        <h3 className="mt-1 text-[15px] leading-snug font-semibold tracking-[-0.01em] text-ink">
          <Link href={`/resources/${resource.slug}`} className="hover:text-brand-700">
            {resource.title}
          </Link>
        </h3>

        {resource.authorName || resource.organizationName ? (
          <p className="mt-0.5 truncate text-xs text-muted">
            {[resource.authorName, resource.organizationName].filter(Boolean).join(" · ")}
          </p>
        ) : null}

        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted">{resource.description}</p>

        <div className="mt-2.5 flex flex-wrap items-center gap-1">
          {resource.topics.slice(0, 4).map((topic) => (
            <TopicChip key={topic.slug} slug={topic.slug} name={topic.name} />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted">
          <StarRating value={resource.communityScore} count={resource.ratingsCount || undefined} />
          <span className="flex items-center gap-1">
            <Icon name="bookmark" className="size-3" />
            {compactNumber(resource.savesCount)} {dict.common.saved.toLowerCase()}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="eye" className="size-3" />
            {compactNumber(resource.viewsCount)} views
          </span>
          <span className="ml-auto flex items-center gap-2">
            <Chip className={level.chip}>{dict.difficulty[resource.difficulty]}</Chip>
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              aria-label={`Open ${resource.title} in a new tab`}
              className="inline-flex size-7 items-center justify-center rounded-lg border border-hairline text-muted transition-colors hover:border-brand-200 hover:text-brand-600"
            >
              <Icon name="arrow-up-right" className="size-3.5" />
            </a>
          </span>
        </div>
      </div>
    </Card>
  );
}

/** Compact one-line entry for sidebars and trending lists. */
export function ResourceMiniRow({ resource, rank }: { resource: ResourceListItem; rank?: number }) {
  const dict = useDictionary();
  return (
    <Link
      href={`/resources/${resource.slug}`}
      className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-hover"
    >
      {rank != null ? (
        <span className="mt-0.5 w-5 shrink-0 text-center text-xs font-semibold text-muted tabular-nums">
          {String(rank).padStart(2, "0")}
        </span>
      ) : (
        <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-lg", accent(resource.typeAccent).tile)}>
          <Icon name={resource.typeIcon} className="size-4" strokeWidth={1.7} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <TypeLabel name={typeLabel(resource.typeSlug, resource.typeName, dict)} accent={resource.typeAccent} />
        </span>
        <span className="mt-0.5 block line-clamp-2 text-[13px] leading-snug font-medium text-ink">{resource.title}</span>
        <span className="mt-1 flex items-center gap-2.5 text-[11px] text-muted">
          {resource.organizationName ?? resource.authorName ?? ""}
          <StarRating value={resource.communityScore} />
          <span className="flex items-center gap-1">
            <Icon name="bookmark" className="size-3" />
            {compactNumber(resource.savesCount)}
          </span>
        </span>
      </span>
    </Link>
  );
}
