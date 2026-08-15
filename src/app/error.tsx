"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { IconTile } from "@/components/ui/primitives";
import { useDictionary } from "@/components/providers/preferences-provider";
import { formatMessage } from "@/lib/i18n/dictionary";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const dict = useDictionary();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <IconTile icon="shield" accent="rose" size="lg" className="mx-auto" />
      <h1 className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-ink">{dict.errors.brokenTitle}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{dict.errors.brokenBody}</p>
      {error.digest && (
        <p className="mt-2 text-[11px] text-muted tabular-nums">{formatMessage(dict.errors.reference, { digest: error.digest })}</p>
      )}

      <div className="mt-6 flex items-center justify-center gap-2">
        <Button onClick={reset}>{dict.common.tryAgain}</Button>
        <ButtonLink href="/" variant="outline">
          {dict.common.backHome}
        </ButtonLink>
      </div>
    </div>
  );
}
