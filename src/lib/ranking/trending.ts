export type TrendingInput = {
  /** Engagement in the trailing window (default 7 days). */
  recentViews: number;
  recentSaves: number;
  recentClicks: number;
  recentCompletions: number;
  /** The window immediately before it, used for growth rather than volume. */
  priorViews: number;
  priorSaves: number;
  /** 0–100 */
  qualityScore: number;
  /** 0–100, null when no editor has scored it */
  editorScore: number | null;
  publishedAt: Date | null;
};

export type TrendingBreakdown = {
  score: number;
  growthRate: number;
  saveRate: number;
  clickRate: number;
  viewGrowth: number;
  quality: number;
  editorial: number;
  freshnessDecay: number;
};

const WEIGHTS = {
  growthRate: 0.3,
  saveRate: 0.2,
  clickRate: 0.15,
  viewGrowth: 0.15,
  quality: 0.1,
  editorial: 0.1,
} as const;

/**
 * Trending is deliberately about *acceleration*, not volume: a five-year-old
 * paper with a million lifetime views should not outrank a repo that tripled its
 * saves this week. Every component is a rate or a ratio, and the result is
 * multiplied by a freshness decay so nothing squats at the top of the board.
 */
export function computeTrendingScore(input: TrendingInput): TrendingBreakdown {
  const growthRate = ratio(input.recentSaves + input.recentCompletions, input.priorSaves);
  const viewGrowth = ratio(input.recentViews, input.priorViews);
  // Rates are normalised against plausible ceilings (10% save, 60% click) so a
  // resource with three views cannot reach 1.0 on a single interaction.
  const saveRate = clamp01(safeDivide(input.recentSaves, input.recentViews) / 0.1);
  const clickRate = clamp01(safeDivide(input.recentClicks, input.recentViews) / 0.6);
  const quality = clamp01(input.qualityScore / 100);
  const editorial = clamp01((input.editorScore ?? input.qualityScore * 0.8) / 100);

  const base =
    WEIGHTS.growthRate * growthRate +
    WEIGHTS.saveRate * saveRate +
    WEIGHTS.clickRate * clickRate +
    WEIGHTS.viewGrowth * viewGrowth +
    WEIGHTS.quality * quality +
    WEIGHTS.editorial * editorial;

  const freshnessDecay = freshness(input.publishedAt);

  return {
    score: round(base * freshnessDecay * 100),
    growthRate: round(growthRate),
    saveRate: round(saveRate),
    clickRate: round(clickRate),
    viewGrowth: round(viewGrowth),
    quality: round(quality),
    editorial: round(editorial),
    freshnessDecay: round(freshnessDecay),
  };
}

/**
 * Half-life decay with a floor: a genuinely foundational resource that is being
 * rediscovered can still trend, it just has to work harder than a new one.
 */
function freshness(publishedAt: Date | null, halfLifeDays = 240, floor = 0.35): number {
  if (!publishedAt) return floor + (1 - floor) * 0.5;
  const ageDays = Math.max(0, (Date.now() - publishedAt.getTime()) / 86_400_000);
  return floor + (1 - floor) * Math.pow(0.5, ageDays / halfLifeDays);
}

/** Growth as a bounded ratio; `prior` of zero means "new", not "infinite". */
function ratio(recent: number, prior: number): number {
  if (prior <= 0) return recent > 0 ? 0.75 : 0;
  return clamp01(recent / prior / 3);
}

function safeDivide(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
