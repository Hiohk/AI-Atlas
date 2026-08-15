"use client";

import { useState, useTransition } from "react";
import { setResourceStatusAction, toggleEditorPickAction } from "@/app/actions/submissions";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const STATUSES = [
  { value: "published", label: "Publish", short: "Live", icon: "check-circle", active: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { value: "review", label: "Send to review", short: "Review", icon: "eye", active: "bg-amber-50 text-amber-700 ring-amber-200" },
  { value: "archived", label: "Archive", short: "Archive", icon: "archive", active: "bg-slate-100 text-slate-700 ring-slate-300" },
] as const;

export function ResourceActions({
  resourceId,
  status,
  isEditorPick,
}: {
  resourceId: string;
  status: string;
  isEditorPick: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState(isEditorPick);
  const [current, setCurrent] = useState(status);

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        disabled={isPending}
        aria-pressed={pick}
        title={pick ? "Remove editor's pick" : "Mark as editor's pick"}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await toggleEditorPickAction(resourceId);
            if (result.ok) setPick(result.isPick ?? !pick);
            else setError(result.error ?? "Could not update the pick.");
          });
        }}
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-lg ring-1 transition-colors disabled:opacity-50",
          pick
            ? "bg-brand-50 text-brand-600 ring-brand-200"
            : "text-slate-400 ring-transparent hover:bg-slate-100 hover:text-ink",
        )}
      >
        <Icon name="sparkles" className={cn("size-3.5", pick && "fill-current")} />
      </button>

      {STATUSES.map((option) => {
        const active = current === option.value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={isPending || active}
            title={active ? `Already ${option.short.toLowerCase()}` : option.label}
            aria-pressed={active}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await setResourceStatusAction(resourceId, option.value);
                if (result.ok) setCurrent(option.value);
                else setError(result.error ?? "Could not change the status.");
              });
            }}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-lg ring-1 transition-colors disabled:cursor-default",
              active ? option.active : "text-slate-400 ring-transparent hover:bg-slate-100 hover:text-ink disabled:opacity-50",
            )}
          >
            <Icon name={option.icon} className="size-3.5" />
          </button>
        );
      })}

      {error ? <span className="ml-1 text-[11px] text-rose-600">{error}</span> : null}
    </div>
  );
}
