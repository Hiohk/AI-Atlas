import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { accent } from "@/lib/accents";
import { cn } from "@/lib/utils";

/* ── Surfaces ─────────────────────────────────────────────────────────────── */

export function Card({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-card border border-hairline bg-surface shadow-card", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function Panel({ className, children, ...props }: ComponentProps<"section">) {
  return (
    <section className={cn("rounded-2xl border border-hairline bg-surface shadow-card", className)} {...props}>
      {children}
    </section>
  );
}

export function Eyebrow({ icon, children, className }: { icon?: IconName; children: ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-brand-600 uppercase", className)}>
      {icon ? <Icon name={icon} className="size-3.5" /> : null}
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  eyebrowIcon,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  eyebrowIcon?: IconName;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-2", className)}>
      <div className="space-y-1.5">
        {eyebrow ? <Eyebrow icon={eyebrowIcon}>{eyebrow}</Eyebrow> : null}
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-ink sm:text-[22px]">{title}</h2>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ViewAllLink({ href, children = "View all" }: { href: string; children?: ReactNode }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
      {children}
      <Icon name="arrow-right" className="size-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/* ── Labels ───────────────────────────────────────────────────────────────── */

export function Chip({ className, children, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-hover px-1.5 py-0.5 text-[11px] font-medium text-muted ring-1 ring-hairline ring-inset",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function TopicChip({ slug, name, size = "sm" }: { slug: string; name: string; size?: "sm" | "md" }) {
  return (
    <Link
      href={`/topics/${slug}`}
      className={cn(
        "inline-flex items-center rounded-md bg-hover font-medium text-muted ring-1 ring-hairline ring-inset transition-colors hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-100",
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
      )}
    >
      {name}
    </Link>
  );
}

/** Uppercase type label, coloured by the resource type's accent. */
export function TypeLabel({ name, accent: accentName, className }: { name: string; accent: string; className?: string }) {
  return (
    <span className={cn("text-[10px] font-bold tracking-[0.1em] uppercase", accent(accentName).text, className)}>
      {name}
    </span>
  );
}

export function IconTile({
  icon,
  accent: accentName,
  size = "md",
  className,
}: {
  icon: string;
  accent: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "size-8 rounded-lg [&_svg]:size-4",
    md: "size-11 rounded-xl [&_svg]:size-5",
    lg: "size-14 rounded-2xl [&_svg]:size-6",
  } as const;
  return (
    <span className={cn("inline-flex items-center justify-center", accent(accentName).tile, sizes[size], className)}>
      <Icon name={icon} className="" strokeWidth={1.9} />
    </span>
  );
}

/* ── Data display ─────────────────────────────────────────────────────────── */

export function StarRating({
  value,
  count,
  className,
  showValue = true,
}: {
  value: number | string | null | undefined;
  count?: number | null;
  className?: string;
  showValue?: boolean;
}) {
  const rating = Number(value ?? 0);
  if (!rating) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] text-muted", className)}>
      <Icon name="star" className="size-3.5 fill-amber-400 text-amber-400" />
      {showValue ? <span className="font-semibold text-ink">{rating.toFixed(1)}</span> : null}
      {count ? <span className="text-muted">({count})</span> : null}
    </span>
  );
}

export function Stat({
  icon,
  label,
  value,
  className,
}: {
  icon?: IconName;
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {icon ? (
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Icon name={icon} className="size-4" />
        </span>
      ) : null}
      <div className="leading-tight">
        <p className="text-sm font-semibold text-ink">{value}</p>
        <p className="text-[11px] text-muted">{label}</p>
      </div>
    </div>
  );
}

export function Progress({
  value,
  className,
  barClassName,
}: {
  value: number;
  className?: string;
  barClassName?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-slate-100", className)}
    >
      <div className={cn("h-full rounded-full bg-brand-500 transition-[width] duration-500", barClassName)} style={{ width: `${clamped}%` }} />
    </div>
  );
}

/** Three-segment difficulty meter, as in the resource detail mockup. */
export function DifficultyMeter({ level, className }: { level: string; className?: string }) {
  const steps = level === "beginner" ? 1 : level === "advanced" ? 3 : 2;
  const color = level === "beginner" ? "bg-emerald-500" : level === "advanced" ? "bg-rose-500" : "bg-brand-500";
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {[0, 1, 2].map((index) => (
        <span key={index} className={cn("h-1.5 w-6 rounded-full", index < steps ? color : "bg-slate-200")} />
      ))}
    </span>
  );
}

export function Avatar({
  src,
  name,
  size = 28,
  className,
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      title={name}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.36) }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-semibold text-brand-700 ring-2 ring-white",
        className,
      )}
    >
      {src ? (
        // Avatars come from arbitrary hosts; next/image adds no value for a 28px decorative element.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} className="size-full object-cover" loading="lazy" />
      ) : (
        initials
      )}
    </span>
  );
}

export function AvatarStack({
  people,
  max = 5,
  extra,
}: {
  people: Array<{ displayName: string; avatarUrl?: string | null }>;
  max?: number;
  extra?: number;
}) {
  const shown = people.slice(0, max);
  const remaining = extra ?? Math.max(0, people.length - shown.length);
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((person) => (
          <Avatar key={person.displayName} src={person.avatarUrl} name={person.displayName} />
        ))}
      </div>
      {remaining > 0 ? <span className="ml-2 text-xs font-medium text-muted">+{remaining}</span> : null}
    </div>
  );
}

/* ── Feedback ─────────────────────────────────────────────────────────────── */

export function EmptyState({
  icon = "search",
  title,
  description,
  action,
  className,
}: {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-hairline bg-surface/60 px-6 py-14 text-center", className)}>
      <span className="mb-3 inline-flex size-11 items-center justify-center rounded-xl bg-slate-50 text-muted">
        <Icon name={icon} className="size-5" />
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-slate-100", className)} />;
}

export function Callout({
  tone = "brand",
  icon,
  title,
  children,
  className,
}: {
  tone?: "brand" | "amber" | "rose" | "emerald";
  icon?: IconName;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const tones = {
    brand: "border-brand-100 bg-brand-50/60 text-brand-900",
    amber: "border-amber-100 bg-amber-50/70 text-amber-900",
    rose: "border-rose-100 bg-rose-50/70 text-rose-900",
    emerald: "border-emerald-100 bg-emerald-50/70 text-emerald-900",
  } as const;
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone], className)}>
      {title ? (
        <p className="mb-1 flex items-center gap-1.5 font-semibold">
          {icon ? <Icon name={icon} className="size-4" /> : null}
          {title}
        </p>
      ) : null}
      {children}
    </div>
  );
}
