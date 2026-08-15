"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { submitReview } from "@/app/actions/library";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Card } from "@/components/ui/primitives";
import { useDictionary } from "@/components/providers/preferences-provider";
import { formatMessage } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";

export function ReviewForm({ resourceId, isSignedIn }: { resourceId: string; isSignedIn: boolean }) {
  const dict = useDictionary();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isSignedIn) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-[13px] text-muted">{dict.resourceDetail.signInReviewHint}</p>
        <Link href="/login" className="text-[13px] font-medium text-brand-600 hover:text-brand-700">
          {dict.resourceDetail.signInToReview}
        </Link>
      </Card>
    );
  }

  if (status === "done") {
    return (
      <Card className="flex items-center gap-2 p-4 text-[13px] text-emerald-700">
        <Icon name="check-circle" className="size-4" />
        {dict.resourceDetail.thanksReview}
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (rating === 0) {
            setMessage(dict.resourceDetail.pickRating);
            return;
          }
          const formData = new FormData();
          formData.set("resourceId", resourceId);
          formData.set("rating", String(rating));
          if (body.trim()) formData.set("body", body.trim());

          startTransition(async () => {
            const result = await submitReview(formData);
            if (result.ok) setStatus("done");
            else {
              setStatus("error");
              setMessage(result.error);
            }
          });
        }}
      >
        <div className="flex items-center gap-3">
          <p className="text-[13px] font-medium text-ink">Your rating</p>
          <div className="flex items-center gap-0.5" onMouseLeave={() => setHovered(0)}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-label={formatMessage(value === 1 ? dict.resourceDetail.star : dict.resourceDetail.star_plural, { count: value })}
                onMouseEnter={() => setHovered(value)}
                onClick={() => {
                  setRating(value);
                  setMessage(null);
                }}
                className="p-0.5"
              >
                <Icon
                  name="star"
                  className={cn(
                    "size-5 transition-colors",
                    (hovered || rating) >= value ? "fill-amber-400 text-amber-400" : "text-slate-300",
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          maxLength={2000}
          placeholder={dict.resourceDetail.reviewPlaceholder}
          className="mt-3 w-full resize-y rounded-xl border border-hairline bg-surface px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-brand-300"
        />

        <div className="mt-2.5 flex items-center justify-between gap-3">
          <p className={cn("text-[12px]", status === "error" ? "text-rose-600" : "text-muted")}>
            {message ?? `${body.length}/2000`}
          </p>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? <Icon name="loader" className="size-3.5 animate-spin" /> : null}
            {dict.resourceDetail.postReview}
          </Button>
        </div>
      </form>
    </Card>
  );
}
