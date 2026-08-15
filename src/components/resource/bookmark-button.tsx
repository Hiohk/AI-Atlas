"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { setLearningState, toggleSaved } from "@/app/actions/library";
import { Icon } from "@/components/ui/icon";
import { useDictionary } from "@/components/providers/preferences-provider";
import type { LearningState } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

export function BookmarkButton({
  resourceId,
  state,
  className,
  size = "md",
}: {
  resourceId: string;
  state: LearningState | null;
  className?: string;
  size?: "sm" | "md";
}) {
  const dict = useDictionary();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useOptimistic(state !== null);
  const [error, setError] = useState<string | null>(null);

  return (
    <button
      type="button"
      aria-label={saved ? dict.state.removeFromLibrary : dict.state.saveToLibrary}
      aria-pressed={saved}
      title={error ?? (saved ? dict.state.savedToLibrary : dict.state.saveToLibrary)}
      disabled={isPending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        startTransition(async () => {
          setSaved(!saved);
          const result = await toggleSaved(resourceId);
          if (!result.ok) {
            setError(result.error);
            if (result.requiresAuth) router.push("/login?redirectTo=/resources");
          }
        });
      }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg transition-colors",
        size === "sm" ? "size-7" : "size-8",
        saved ? "text-brand-600 hover:bg-brand-50" : "text-muted hover:bg-slate-100 hover:text-ink",
        className,
      )}
    >
      <Icon name="bookmark" className={cn(size === "sm" ? "size-3.5" : "size-4", saved && "fill-current")} />
    </button>
  );
}

/** Full progress control for the resource detail page. */
export function LearningStateControl({
  resourceId,
  state,
  className,
}: {
  resourceId: string;
  state: LearningState | null;
  className?: string;
}) {
  const dict = useDictionary();
  const router = useRouter();
  const [current, setCurrent] = useState(state);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const states = [
    { value: "saved" as const, label: dict.state.wantToLearn, icon: "bookmark" },
    { value: "in_progress" as const, label: dict.state.in_progress, icon: "circle-dashed" },
    { value: "completed" as const, label: dict.state.completed, icon: "check-circle" },
  ];

  function choose(next: LearningState | null) {
    startTransition(async () => {
      const previous = current;
      setCurrent(next);
      const result = await setLearningState(resourceId, next);
      if (!result.ok) {
        setCurrent(previous);
        setError(result.error);
        if (result.requiresAuth) router.push(`/login?redirectTo=/resources`);
      } else {
        setError(null);
      }
    });
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-1.5">
        {states.map((option) => {
          const active = current === option.value;
          return (
            <button
              key={option.label}
              type="button"
              disabled={isPending}
              onClick={() => choose(active ? null : option.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                active
                  ? "border-brand-200 bg-brand-50 text-brand-700"
                  : "border-hairline bg-surface text-muted hover:border-brand-200 hover:text-ink",
              )}
            >
              <Icon name={option.icon} className={cn("size-3.5", active && option.value === "saved" && "fill-current")} />
              {option.label}
            </button>
          );
        })}
      </div>
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
