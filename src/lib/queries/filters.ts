import { RESOURCES_PER_PAGE } from "@/lib/config";
import type { ResourceFilters, ResourceSort } from "./types";

export type RawSearchParams = Record<string, string | string[] | undefined>;

const SORTS: ResourceSort[] = ["recommended", "trending", "newest", "popular", "quality", "rating", "relevance"];

function list(value: string | string[] | undefined): string[] {
  if (!value) return [];
  // A repeated param arrives as an array; a comma-joined one is also accepted so
  // filter links stay readable.
  return (Array.isArray(value) ? value : value.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

function flag(value: string | string[] | undefined): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "1" || raw === "true";
}

/** Single place where URL state becomes a typed filter object. */
export function parseResourceFilters(
  params: RawSearchParams,
  defaults: Partial<ResourceFilters> = {},
): ResourceFilters & { view: "grid" | "list" } {
  const sortParam = Array.isArray(params.sort) ? params.sort[0] : params.sort;
  const pageParam = Number(Array.isArray(params.page) ? params.page[0] : params.page);
  const viewParam = Array.isArray(params.view) ? params.view[0] : params.view;

  return {
    ...defaults,
    q: (Array.isArray(params.q) ? params.q[0] : params.q)?.slice(0, 200) || undefined,
    topic: defaults.topic ?? (Array.isArray(params.topic) ? params.topic[0] : params.topic),
    types: list(params.type),
    difficulties: list(params.difficulty).filter((value) => ["beginner", "intermediate", "advanced"].includes(value)),
    languages: list(params.lang),
    free: flag(params.free) || undefined,
    hasCode: flag(params.code) || undefined,
    official: flag(params.official) || undefined,
    editorPicks: flag(params.picks) || undefined,
    updatedWithinDays: flag(params.fresh) ? 30 : undefined,
    sort: SORTS.includes(sortParam as ResourceSort) ? (sortParam as ResourceSort) : (defaults.sort ?? "recommended"),
    page: Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1,
    perPage: defaults.perPage ?? RESOURCES_PER_PAGE,
    view: viewParam === "grid" ? "grid" : "list",
  };
}

/** Normalises the params back into a plain record for link building. */
export function filtersToQuery(params: RawSearchParams): Record<string, string | string[]> {
  const output: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    output[key] = value;
  }
  return output;
}

export function countActiveFilters(filters: ResourceFilters): number {
  return (
    (filters.types?.length ?? 0) +
    (filters.difficulties?.length ?? 0) +
    (filters.languages?.length ?? 0) +
    (filters.free ? 1 : 0) +
    (filters.hasCode ? 1 : 0) +
    (filters.official ? 1 : 0) +
    (filters.editorPicks ? 1 : 0) +
    (filters.updatedWithinDays ? 1 : 0)
  );
}

/** Toggles one value of a repeatable param, preserving everything else. */
export function toggleParam(
  params: Record<string, string | string[]>,
  key: string,
  value: string,
): Record<string, string | string[]> {
  const current = list(params[key]);
  const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  const output: Record<string, string | string[]> = { ...params, page: "1" };
  if (next.length === 0) delete output[key];
  else output[key] = next;
  return output;
}

export function setParam(
  params: Record<string, string | string[]>,
  key: string,
  value: string | undefined,
): Record<string, string | string[]> {
  const output: Record<string, string | string[]> = { ...params, page: "1" };
  if (!value) delete output[key];
  else output[key] = value;
  return output;
}
