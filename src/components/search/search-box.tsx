"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useDictionary } from "@/components/providers/preferences-provider";
import { Icon } from "@/components/ui/icon";
import { accent } from "@/lib/accents";
import { cn } from "@/lib/utils";

type Suggestions = {
  resources: Array<{ slug: string; title: string; typeName: string; typeAccent: string }>;
  topics: Array<{ slug: string; name: string; accent: string; icon: string }>;
};

export function SearchBox({
  defaultValue = "",
  placeholder,
  size = "md",
  autoFocus = false,
  showButton = true,
  action = "/search",
  className,
}: {
  defaultValue?: string;
  placeholder?: string;
  size?: "sm" | "md" | "lg";
  autoFocus?: boolean;
  showButton?: boolean;
  /** Destination for a typed query. Suggestions still deep-link to topics/resources. */
  action?: string;
  className?: string;
}) {
  const dict = useDictionary();
  const resolvedPlaceholder = placeholder ?? dict.search.placeholder;
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  // Stored with the query they belong to, so a stale response is ignored during
  // render rather than cleared through a second state update.
  const [cache, setCache] = useState<{ query: string; data: Suggestions } | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced suggestions, aborted on each keystroke so a slow response can
  // never overwrite the results of a newer query.
  useEffect(() => {
    const text = value.trim();
    if (text.length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(text)}`, { signal: controller.signal });
        if (response.ok) setCache({ query: text, data: (await response.json()) as Suggestions });
      } catch {
        /* aborted or offline; the form still submits */
      }
    }, 160);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const trimmed = value.trim();
  const suggestions = trimmed.length >= 2 && cache?.query === trimmed ? cache.data : null;

  const flat = [
    ...(suggestions?.topics ?? []).map((topic) => ({ kind: "topic" as const, href: `/topics/${topic.slug}`, label: topic.name, meta: dict.search.topic, accentName: topic.accent, icon: topic.icon })),
    ...(suggestions?.resources ?? []).map((resource) => ({ kind: "resource" as const, href: `/resources/${resource.slug}`, label: resource.title, meta: resource.typeName, accentName: resource.typeAccent, icon: "file-text" })),
  ];

  function submit(query: string) {
    const text = query.trim();
    if (!text) return;
    setOpen(false);
    startTransition(() => router.push(`${action}?q=${encodeURIComponent(text)}`));
  }

  const heights = { sm: "h-9 text-[13px]", md: "h-11 text-sm", lg: "h-14 text-[15px]" } as const;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (activeIndex >= 0 && flat[activeIndex]) router.push(flat[activeIndex].href);
          else submit(value);
        }}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl border border-hairline bg-surface pl-3 shadow-card transition-shadow focus-within:border-brand-300 focus-within:shadow-lift",
          size === "lg" ? "p-1.5 pl-4" : "pr-1.5",
          heights[size],
        )}
      >
        <Icon name="search" className={cn("text-muted", size === "lg" ? "size-5" : "size-4")} />
        <input
          type="search"
          name="q"
          value={value}
          autoFocus={autoFocus}
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) => Math.min(flat.length - 1, index + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(-1, index - 1));
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={resolvedPlaceholder}
          aria-label={dict.search.placeholder}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted/80 [&::-webkit-search-cancel-button]:hidden"
        />
        {showButton ? (
          <button
            type="submit"
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand-600 font-medium text-white transition-colors hover:bg-brand-700",
              size === "lg" ? "h-11 px-6 text-sm" : "h-8 px-3 text-[13px]",
            )}
          >
            {isPending ? <Icon name="loader" className="size-4 animate-spin" /> : null}
            {dict.search.button}
          </button>
        ) : null}
      </form>

      {open && flat.length > 0 ? (
        <div className="absolute top-full left-0 z-50 mt-2 w-full overflow-hidden rounded-xl border border-hairline bg-surface p-1.5 shadow-lift">
          {flat.map((item, index) => (
            <a
              key={`${item.kind}-${item.href}`}
              href={item.href}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
                index === activeIndex ? "bg-brand-50" : "hover:bg-hover",
              )}
            >
              <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-lg", accent(item.accentName).tile)}>
                <Icon name={item.icon} className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-ink">{item.label}</span>
              <span className="shrink-0 text-[11px] font-medium text-muted">{item.meta}</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
