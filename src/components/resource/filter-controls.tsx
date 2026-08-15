"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { useDictionary } from "@/components/providers/preferences-provider";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string; count?: number };

function useParamNavigation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function update(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete("page");
    startTransition(() => router.push(`?${params.toString()}`, { scroll: false }));
  }

  return { update, isPending, searchParams };
}

/**
 * Native selects rather than a custom popover: filter state lives in the URL,
 * and a select gives keyboard and mobile behaviour for free.
 */
export function FilterSelect({
  param,
  label,
  options,
  multiple = false,
}: {
  param: string;
  label: string;
  options: Option[];
  multiple?: boolean;
}) {
  const dict = useDictionary();
  const { update, isPending, searchParams } = useParamNavigation();
  const current = searchParams.getAll(param);
  const value = multiple ? (current[0] ?? "") : (current[0] ?? "");
  const activeCount = current.length;

  return (
    <label
      className={cn(
        "relative inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border bg-surface pr-7 pl-3 text-[13px] transition-colors",
        activeCount > 0 ? "border-brand-200 text-brand-700" : "border-hairline text-muted hover:border-slate-300",
        isPending && "opacity-60",
      )}
    >
      <span className="font-medium whitespace-nowrap">
        {label}
        {activeCount > 0 ? <span className="ml-1 text-brand-600">({activeCount})</span> : null}
      </span>
      <Icon name="chevron-down" className="pointer-events-none absolute right-2 size-3.5" />
      <select
        aria-label={label}
        value={value}
        onChange={(event) =>
          update((params) => {
            params.delete(param);
            if (event.target.value) params.set(param, event.target.value);
          })
        }
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="">{dict.filters.all}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
            {option.count != null ? ` (${option.count})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SortSelect({ options, defaultValue = "recommended" }: { options: readonly Option[]; defaultValue?: string }) {
  const dict = useDictionary();
  const { update, isPending, searchParams } = useParamNavigation();
  const current = searchParams.get("sort") ?? defaultValue;
  const label = options.find((option) => option.value === current)?.label ?? dict.sorts.recommended;

  return (
    <label
      className={cn(
        "relative inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-hairline bg-surface pr-7 pl-3 text-[13px] text-muted transition-colors hover:border-slate-300",
        isPending && "opacity-60",
      )}
    >
      <span className="whitespace-nowrap">
        {dict.filters.sortBy}: <span className="font-medium text-ink">{label}</span>
      </span>
      <Icon name="chevron-down" className="pointer-events-none absolute right-2 size-3.5" />
      <select
        aria-label={dict.filters.sortBy}
        value={current}
        onChange={(event) => update((params) => params.set("sort", event.target.value))}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ViewToggle() {
  const dict = useDictionary();
  const { update, searchParams } = useParamNavigation();
  const view = searchParams.get("view") === "grid" ? "grid" : "list";

  return (
    <div className="inline-flex h-9 items-center rounded-lg border border-hairline bg-surface p-0.5">
      {(["list", "grid"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          aria-label={mode === "grid" ? dict.filters.gridView : dict.filters.listView}
          aria-pressed={view === mode}
          onClick={() => update((params) => params.set("view", mode))}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-md transition-colors",
            view === mode ? "bg-brand-50 text-brand-600" : "text-muted hover:text-ink",
          )}
        >
          <Icon name={mode === "grid" ? "layout" : "list-checks"} className="size-3.5" />
        </button>
      ))}
    </div>
  );
}

/** Checkbox row used in the facet sidebar; toggles a repeatable URL param. */
export function FacetCheckbox({
  param,
  value,
  label,
  count,
}: {
  param: string;
  value: string;
  label: string;
  count?: number;
}) {
  const { update, searchParams, isPending } = useParamNavigation();
  const checked = searchParams.getAll(param).includes(value);

  return (
    <button
      type="button"
      onClick={() =>
        update((params) => {
          const current = params.getAll(param);
          params.delete(param);
          const next = checked ? current.filter((item) => item !== value) : [...current, value];
          for (const item of next) params.append(param, item);
        })
      }
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-hover",
        isPending && "opacity-60",
      )}
    >
      <span
        className={cn(
          "inline-flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
          checked ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-surface",
        )}
      >
        {checked ? <Icon name="check" className="size-3" strokeWidth={3} /> : null}
      </span>
      <span className={cn("min-w-0 flex-1 truncate", checked ? "font-medium text-ink" : "text-muted")}>{label}</span>
      {count != null ? <span className="shrink-0 text-[11px] text-slate-400 tabular-nums">{count}</span> : null}
    </button>
  );
}

export function QuickFilterToggle({ param, label }: { param: string; label: string }) {
  const { update, searchParams } = useParamNavigation();
  const active = searchParams.get(param) === "1";

  return (
    <button
      type="button"
      onClick={() =>
        update((params) => {
          if (active) params.delete(param);
          else params.set(param, "1");
        })
      }
      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-muted transition-colors hover:bg-hover"
    >
      <span className={cn("truncate", active && "font-medium text-ink")}>{label}</span>
      <span
        className={cn(
          "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors",
          active ? "bg-brand-600" : "bg-slate-200",
        )}
      >
        <span className={cn("absolute size-3 rounded-full bg-surface transition-all", active ? "left-3.5" : "left-0.5")} />
      </span>
    </button>
  );
}

export function ClearFiltersButton({ keep = [] }: { keep?: string[] }) {
  const dict = useDictionary();
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <button
      type="button"
      onClick={() => {
        const params = new URLSearchParams();
        for (const key of keep) {
          const value = searchParams.get(key);
          if (value) params.set(key, value);
        }
        router.push(`?${params.toString()}`, { scroll: false });
      }}
      className="text-[12px] font-medium text-brand-600 hover:text-brand-700"
    >
      {dict.filters.clearAll}
    </button>
  );
}
