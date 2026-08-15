import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2", className)} aria-label="AI Atlas home">
      <span className="relative inline-flex size-7 items-center justify-center">
        <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
          <defs>
            <linearGradient id="atlas-mark" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          <path
            d="M16 2.5l2.6 8.1a6 6 0 003.8 3.8l8.1 2.6-8.1 2.6a6 6 0 00-3.8 3.8L16 31.5l-2.6-8.1a6 6 0 00-3.8-3.8L1.5 17l8.1-2.6a6 6 0 003.8-3.8L16 2.5z"
            fill="url(#atlas-mark)"
          />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">AI Atlas</span>
    </Link>
  );
}
