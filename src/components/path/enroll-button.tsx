"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enrollInPath } from "@/app/actions/library";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useDictionary } from "@/components/providers/preferences-provider";

export function EnrollButton({
  pathId,
  pathSlug,
  isEnrolled,
  size = "md",
}: {
  pathId: string;
  pathSlug: string;
  isEnrolled: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const dict = useDictionary();
  const router = useRouter();
  const [enrolled, setEnrolled] = useState(isEnrolled);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    startTransition(async () => {
      const previous = enrolled;
      setEnrolled(!previous);
      const result = await enrollInPath(pathId);
      if (!result.ok) {
        setEnrolled(previous);
        if (result.requiresAuth) {
          router.push(`/login?redirectTo=/paths/${pathSlug}`);
          return;
        }
        setError(result.error);
        return;
      }
      setEnrolled(result.data?.enrolled ?? !previous);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        onClick={toggle}
        disabled={isPending}
        size={size}
        variant={enrolled ? "outline" : "primary"}
        title={error ?? undefined}
      >
        {isPending ? (
          <Icon name="loader" className="size-4 animate-spin" />
        ) : (
          <Icon name={enrolled ? "check-circle" : "rocket"} className="size-4" />
        )}
        {enrolled ? dict.pathsPage.enrolled : dict.pathsPage.enroll}
      </Button>
      {error && <span className="text-[11px] text-rose-600">{error}</span>}
    </div>
  );
}
