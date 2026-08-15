"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useDictionary } from "@/components/providers/preferences-provider";
import { siteConfig } from "@/lib/config";

type Props = {
  title: string;
  slug: string;
  authors?: string | null;
  year?: string | number | null;
  sourceUrl: string;
};

function apaCitation({ title, authors, year, sourceUrl }: Props) {
  const who = authors?.trim() || "Unknown";
  const when = year ? `(${year})` : "(n.d.)";
  return `${who} ${when}. ${title}. ${siteConfig.name}. ${sourceUrl}`;
}

function bibtex({ title, slug, authors, year, sourceUrl }: Props) {
  const key = slug.replace(/[^a-z0-9]+/gi, "").slice(0, 24) || "resource";
  const author = (authors ?? "Unknown").replace(/,/g, " and");
  return `@misc{${key},
  title     = {${title}},
  author    = {${author}},
  year      = {${year ?? "n.d."}},
  url       = {${sourceUrl}},
  note      = {Curated on ${siteConfig.name}}
}`;
}

export function ResourceShareActions(props: Props) {
  const dict = useDictionary();
  const [copied, setCopied] = useState<"link" | "cite" | null>(null);
  const [citeOpen, setCiteOpen] = useState(false);
  const pageUrl = `${siteConfig.url}/resources/${props.slug}`;
  const payload = { ...props, sourceUrl: pageUrl };

  async function copy(text: string, kind: "link" | "cite") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard can be denied; the text is still visible in the cite panel */
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: props.title, url: pageUrl, text: props.title });
        return;
      } catch {
        /* user cancelled or share unsupported — fall through to copy */
      }
    }
    await copy(pageUrl, "link");
  }

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => setCiteOpen((open) => !open)}>
        <Icon name="quote" className="size-3.5" />
        {dict.common.cite}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => void share()}>
        <Icon name={copied === "link" ? "check" : "share"} className="size-3.5" />
        {copied === "link" ? dict.common.copied : dict.common.share}
      </Button>

      {citeOpen ? (
        <div className="absolute top-full left-0 z-20 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-hairline bg-surface p-3 shadow-lift">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-ink uppercase">{dict.share.citeThis}</p>
          <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-slate-50 p-2.5 text-[11px] leading-relaxed whitespace-pre-wrap text-ink">
            {apaCitation(payload)}
          </pre>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button type="button" variant="subtle" size="sm" onClick={() => void copy(apaCitation(payload), "cite")}>
              <Icon name={copied === "cite" ? "check" : "copy"} className="size-3.5" />
              {dict.share.apa}
            </Button>
            <Button type="button" variant="subtle" size="sm" onClick={() => void copy(bibtex(payload), "cite")}>
              <Icon name="copy" className="size-3.5" />
              {dict.share.bibtex}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCiteOpen(false)}>
              {dict.common.close}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
