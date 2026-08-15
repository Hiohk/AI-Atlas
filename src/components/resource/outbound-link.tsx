"use client";

import { useTransition } from "react";
import { recordResourceClick } from "@/app/actions/library";
import { Icon } from "@/components/ui/icon";
import { buttonClass } from "@/components/ui/button";
import { useDictionary } from "@/components/providers/preferences-provider";

/**
 * Opens the source and records the click. Navigation is never blocked on the
 * tracking call: the click-through is the point, the analytics is a side effect.
 */
export function OutboundLink({
  resourceId,
  href,
  typeSlug,
  variant = "primary",
  size = "md",
  label,
}: {
  resourceId: string;
  href: string;
  typeSlug: string;
  variant?: "primary" | "outline" | "subtle" | "ghost";
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const dict = useDictionary();
  const [, startTransition] = useTransition();
  const cta = dict.outbound[typeSlug as keyof typeof dict.outbound] ?? dict.outbound.fallback;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onClick={() => startTransition(() => void recordResourceClick(resourceId))}
      className={buttonClass({ variant, size })}
    >
      {label ?? cta}
      <Icon name="arrow-up-right" className={size === "sm" ? "size-3.5" : "size-4"} />
    </a>
  );
}

export function ShareButton({ title, path }: { title: string; path: string }) {
  const dict = useDictionary();
  return (
    <button
      type="button"
      onClick={async () => {
        const url = `${window.location.origin}${path}`;
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
            return;
          } catch {
            /* user dismissed the sheet */
          }
        }
        await navigator.clipboard.writeText(url);
      }}
      className={buttonClass({ variant: "subtle", size: "md" })}
    >
      <Icon name="share" className="size-4" />
      {dict.common.share}
    </button>
  );
}
