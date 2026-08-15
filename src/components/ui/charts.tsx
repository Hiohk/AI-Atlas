import { cn } from "@/lib/utils";

/**
 * Inline SVG sparkline. Deliberately not a charting library: these are 60×20
 * decorative trend indicators rendered on the server, and a dependency here
 * would cost more than it returns.
 */
export function Sparkline({
  values,
  width = 64,
  height = 22,
  className,
  strokeClassName = "stroke-brand-500",
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  strokeClassName?: string;
}) {
  const points = values.filter((value) => Number.isFinite(value));
  if (points.length < 2) return <span className={cn("inline-block", className)} style={{ width, height }} />;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const path = points
    .map((value, index) => {
      const x = index * step;
      // Inset by 2px top and bottom so the stroke is never clipped.
      const y = height - 2 - ((value - min) / span) * (height - 4);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("overflow-visible", className)}
      aria-hidden
      preserveAspectRatio="none"
    >
      <path d={path} fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={strokeClassName} />
    </svg>
  );
}

export function GrowthBadge({ value, className }: { value: number; className?: string }) {
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "text-[11px] font-semibold tabular-nums",
        positive ? "text-emerald-600" : "text-rose-600",
        className,
      )}
    >
      {positive ? "+" : ""}
      {Math.round(value)}%
    </span>
  );
}

/**
 * Topic attention over time. Values arrive normalised per topic, so the colour
 * ramp compares a topic against its own baseline rather than against the
 * largest topic on the board.
 */
export function AttentionHeatmap({
  topics,
  days,
  cells,
}: {
  topics: Array<{ slug: string; name: string }>;
  days: string[];
  cells: Array<{ topic: string; day: string; value: number }>;
}) {
  const lookup = new Map(cells.map((cell) => [`${cell.topic}|${cell.day}`, cell.value]));
  const labelEvery = Math.max(1, Math.ceil(days.length / 6));

  return (
    <div className="overflow-x-auto scrollbar-none">
      <div className="min-w-[36rem]">
        <div className="flex gap-2">
          <div className="w-24 shrink-0" />
          <div className="flex flex-1 gap-[3px]">
            {days.map((day, index) => (
              <div key={day} className="flex-1 text-center text-[9px] text-slate-400">
                {index % labelEvery === 0
                  ? new Date(day).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : ""}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-1.5 space-y-[3px]">
          {topics.map((topic) => (
            <div key={topic.slug} className="flex items-center gap-2">
              <div className="w-24 shrink-0 truncate text-[11px] text-muted" title={topic.name}>
                {topic.name}
              </div>
              <div className="flex flex-1 gap-[3px]">
                {days.map((day) => {
                  const value = lookup.get(`${topic.slug}|${day}`) ?? 0;
                  return (
                    <div
                      key={day}
                      title={`${topic.name} · ${new Date(day).toLocaleDateString()} · ${Math.round(value * 100)}% of peak`}
                      className="h-4 flex-1 rounded-[3px] bg-brand-500 transition-opacity"
                      style={{ opacity: 0.08 + value * 0.92 }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted">
          <span>Low</span>
          {[0.12, 0.3, 0.5, 0.7, 1].map((opacity) => (
            <span key={opacity} className="size-3 rounded-[3px] bg-brand-500" style={{ opacity }} />
          ))}
          <span>High</span>
        </div>
      </div>
    </div>
  );
}
