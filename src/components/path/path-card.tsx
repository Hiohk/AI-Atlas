"use client";

import Link from "next/link";
import { useDictionary } from "@/components/providers/preferences-provider";
import { Icon } from "@/components/ui/icon";
import { Card, Chip, IconTile, Progress } from "@/components/ui/primitives";
import { difficulty as difficultyStyle } from "@/lib/accents";
import { formatMessage, pluralNoun } from "@/lib/i18n/dictionary";
import type { PathSummary } from "@/lib/queries/paths";
import { cn, compactNumber } from "@/lib/utils";

export function PathCard({ path, className }: { path: PathSummary; className?: string }) {
  const dict = useDictionary();
  const level = difficultyStyle(path.difficulty);
  const difficultyLabel = dict.difficulty[path.difficulty];

  return (
    <Link href={`/paths/${path.slug}`} className={cn("group block", className)}>
      <Card className="relative flex h-full flex-col p-4 transition-shadow hover:shadow-lift">
        {path.isPopular ? (
          <span className="absolute top-4 right-4 rounded-md bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
            {dict.common.popular}
          </span>
        ) : null}

        <IconTile icon={path.icon} accent={path.accent} />

        <h3 className="mt-4 text-[15px] leading-snug font-semibold tracking-[-0.01em] text-ink group-hover:text-brand-700">
          {path.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{path.subtitle ?? path.description}</p>

        {path.progress != null ? (
          <div className="mt-3.5">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium">
              <span className="text-muted">
                {path.completedCount} / {path.resourceCount} {dict.common.done}
              </span>
              <span className="text-brand-600">{path.progress}%</span>
            </div>
            <Progress value={path.progress} />
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-3.5 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <Icon name="layers" className="size-3" />
            {path.resourceCount} {pluralNoun(dict, path.resourceCount, "resource")}
          </span>
          {path.estimatedWeeks ? (
            <span className="flex items-center gap-1">
              <Icon name="clock" className="size-3" />
              {path.estimatedWeeks} {dict.common.weeks}
            </span>
          ) : null}
          <Chip className={cn("ml-auto", level.chip)}>{difficultyLabel}</Chip>
        </div>
      </Card>
    </Link>
  );
}

/** Wide row used on the Learning Paths index, matching the mockup's layout. */
export function PathRow({ path }: { path: PathSummary }) {
  const dict = useDictionary();
  const level = difficultyStyle(path.difficulty);
  const difficultyLabel = dict.difficulty[path.difficulty];

  return (
    <Card className="grid gap-4 p-0 transition-shadow hover:shadow-lift md:grid-cols-[minmax(0,15rem)_1fr_minmax(0,16rem)]">
      <Link href={`/paths/${path.slug}`} className="flex flex-col justify-between gap-3 rounded-l-card bg-hover/70 p-5">
        <div>
          {path.isPopular ? (
            <span className="mb-3 inline-block rounded-md bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
              {dict.common.popular}
            </span>
          ) : null}
          <IconTile icon={path.icon} accent={path.accent} />
          <h3 className="mt-3 text-base leading-snug font-semibold tracking-[-0.01em] text-ink">{path.title}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
          <span>
            {path.resourceCount} {pluralNoun(dict, path.resourceCount, "resource")}
          </span>
          {path.estimatedWeeks ? (
            <span>
              · {path.estimatedWeeks} {dict.common.weeks}
            </span>
          ) : null}
          <Chip className={level.chip}>{difficultyLabel}</Chip>
        </div>
      </Link>

      <div className="flex flex-col justify-center p-5 md:pl-0">
        <p className="text-[13px] leading-relaxed text-muted">{path.description ?? path.subtitle}</p>
        {path.progress != null ? (
          <div className="mt-4 max-w-sm">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium">
              <span className="text-muted">
                {formatMessage(dict.common.completedOf, { done: path.completedCount ?? 0, total: path.resourceCount })}
              </span>
              <span className="text-brand-600">{path.progress}%</span>
            </div>
            <Progress value={path.progress} />
          </div>
        ) : (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
            <Icon name="users" className="size-3" />
            {formatMessage(dict.common.learnersOnPath, { count: compactNumber(path.learnersCount) })}
          </p>
        )}
      </div>

      <div className="border-t border-hairline p-5 md:border-t-0 md:border-l">
        <p className="text-[11px] font-semibold tracking-[0.1em] text-ink uppercase">{dict.common.youWillLearn}</p>
        <ul className="mt-2.5 space-y-1.5">
          {(path.outcomes ?? []).slice(0, 5).map((outcome) => (
            <li key={outcome} className="flex items-start gap-2 text-[12px] leading-snug text-muted">
              <Icon name="check" className="mt-0.5 size-3 shrink-0 text-emerald-500" />
              <span className="line-clamp-1">{outcome}</span>
            </li>
          ))}
        </ul>
        <Link
          href={`/paths/${path.slug}`}
          className="mt-3.5 inline-flex items-center gap-1 text-[13px] font-medium text-brand-600 hover:text-brand-700"
        >
          {dict.common.viewPath}
          <Icon name="arrow-right" className="size-3.5" />
        </Link>
      </div>
    </Card>
  );
}
