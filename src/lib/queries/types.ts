export type ResourceTopicRef = {
  slug: string;
  name: string;
  isPrimary: boolean;
};

/** Everything a resource card needs, in one row. */
export type ResourceListItem = {
  id: string;
  slug: string;
  title: string;
  url: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  language: string;
  priceModel: "free" | "freemium" | "paid";
  estimatedMinutes: number | null;
  authorName: string | null;
  organizationName: string | null;
  thumbnailUrl: string | null;
  isOfficial: boolean;
  hasCode: boolean;
  isEditorPick: boolean;
  editorNote: string | null;
  qualityScore: number;
  communityScore: number | null;
  ratingsCount: number;
  trendingScore: number;
  viewsCount: number;
  savesCount: number;
  publishedAt: string | null;
  sourceUpdatedAt: string | null;
  metadata: Record<string, unknown>;
  typeSlug: string;
  typeName: string;
  typeAccent: string;
  typeIcon: string;
  topics: ResourceTopicRef[];
  bookmarkState: "saved" | "in_progress" | "completed" | null;
};

export type ResourceSort = "recommended" | "trending" | "newest" | "popular" | "quality" | "rating" | "relevance";

export type ResourceFilters = {
  q?: string;
  topic?: string;
  types?: string[];
  difficulties?: string[];
  languages?: string[];
  free?: boolean;
  hasCode?: boolean;
  official?: boolean;
  /** Only resources published or refreshed within N days. */
  updatedWithinDays?: number;
  editorPicks?: boolean;
  sort?: ResourceSort;
  page?: number;
  perPage?: number;
};

export type FacetBucket = {
  value: string;
  label: string;
  count: number;
  accent?: string;
  icon?: string;
};

export type ResourceFacets = {
  types: FacetBucket[];
  difficulties: FacetBucket[];
  languages: FacetBucket[];
  total: number;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};
