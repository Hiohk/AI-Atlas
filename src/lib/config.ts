export const siteConfig = {
  name: "AI Atlas",
  tagline: "The knowledge map for AI",
  description:
    "Discover, understand and learn from the best AI resources. Papers, courses, repos and tutorials — curated by the community, reviewed by editors, organised into learning paths.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  repository: "https://github.com/ai-atlas/ai-atlas",
  /** Editorial reach figure used on About — we do not store country of origin. */
  reachCountries: 48,
} as const;

export const primaryNav = [
  { href: "/explore", label: "Explore" },
  { href: "/paths", label: "Learning Paths" },
  { href: "/trending", label: "Trending" },
] as const;

export const secondaryNav = [{ href: "/about", label: "About" }] as const;

/** Quick filters offered on the resource browser, mirroring the mockup. */
export const QUICK_FILTERS = [
  { key: "free", label: "Free only" },
  { key: "code", label: "Has code" },
  { key: "fresh", label: "Updated in last 30 days" },
  { key: "official", label: "Official / author" },
] as const;

export const SORT_OPTIONS = [
  { value: "recommended", label: "Recommended" },
  { value: "trending", label: "Trending" },
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most viewed" },
  { value: "quality", label: "Highest quality" },
  { value: "rating", label: "Best rated" },
] as const;

export const RESOURCES_PER_PAGE = 12;
