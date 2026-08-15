"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { useDictionary } from "@/components/providers/preferences-provider";
import { buildQuery } from "@/lib/utils";
import { cn } from "@/lib/utils";

/** Windowed pager with first/last anchors, as in the resource browser mockup. */
export function Pagination({
  page,
  pageCount,
  params,
}: {
  page: number;
  pageCount: number;
  params: Record<string, string | string[]>;
}) {
  const dict = useDictionary();
  if (pageCount <= 1) return null;

  const href = (target: number) => `${buildQuery(params, { page: target })}`;
  const window = 1;
  const pages: Array<number | "gap"> = [];

  for (let candidate = 1; candidate <= pageCount; candidate++) {
    const nearCurrent = Math.abs(candidate - page) <= window;
    if (candidate === 1 || candidate === pageCount || nearCurrent) pages.push(candidate);
    else if (pages[pages.length - 1] !== "gap") pages.push("gap");
  }

  return (
    <nav className="flex items-center justify-center gap-1 pt-2" aria-label={dict.common.pagination}>
      <PagerLink href={href(Math.max(1, page - 1))} disabled={page === 1} label={dict.common.previousPage}>
        <Icon name="chevron-left" className="size-3.5" />
      </PagerLink>

      {pages.map((entry, index) =>
        entry === "gap" ? (
          <span key={`gap-${index}`} className="px-1 text-xs text-slate-400">
            …
          </span>
        ) : (
          <Link
            key={entry}
            href={href(entry)}
            aria-current={entry === page ? "page" : undefined}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-lg text-[13px] font-medium transition-colors",
              entry === page ? "bg-brand-600 text-white" : "border border-hairline bg-surface text-muted hover:border-brand-200 hover:text-brand-700",
            )}
          >
            {entry}
          </Link>
        ),
      )}

      <PagerLink href={href(Math.min(pageCount, page + 1))} disabled={page === pageCount} label={dict.common.nextPage}>
        <Icon name="chevron-right" className="size-3.5" />
      </PagerLink>
    </nav>
  );
}

function PagerLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const className = "inline-flex size-8 items-center justify-center rounded-lg border border-hairline bg-surface text-muted transition-colors";
  if (disabled) {
    return (
      <span aria-disabled className={cn(className, "opacity-40")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={cn(className, "hover:border-brand-200 hover:text-brand-700")}>
      {children}
    </Link>
  );
}
