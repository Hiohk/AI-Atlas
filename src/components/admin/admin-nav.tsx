"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export type AdminNavItem = { href: string; label: string; icon: IconName; description?: string };

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

/** Vertical nav for the sticky sidebar on `lg` and up. */
export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="space-y-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
        active ? "bg-brand-50 text-brand-700" : "text-muted hover:bg-hover hover:text-ink",
            )}
          >
            <Icon name={item.icon} className={cn("mt-0.5 size-4", active ? "text-brand-600" : "text-slate-400")} />
            <span className="min-w-0">
              <span className="block">{item.label}</span>
              {item.description ? (
                <span className="mt-0.5 block text-[11px] leading-snug font-normal text-slate-400">
                  {item.description}
                </span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Horizontally scrolling pill nav shown below `lg`. */
export function AdminNavPills({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-hairline bg-surface text-muted hover:border-brand-200 hover:text-ink",
            )}
          >
            <Icon name={item.icon} className="size-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
