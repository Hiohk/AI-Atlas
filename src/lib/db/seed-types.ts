/** Shapes for the seed corpus. Slugs are the join keys; UUIDs are assigned by Postgres. */

export type SeedResourceType = {
  slug: string;
  name: string;
  pluralName: string;
  icon: string;
  accent: string;
  description: string;
  isPrimaryNav?: boolean;
};

export type SeedTopic = {
  slug: string;
  name: string;
  shortName?: string;
  tagline?: string;
  description?: string;
  parent?: string;
  icon: string;
  accent: string;
  isFeatured?: boolean;
  related?: string[];
};

export type SeedResource = {
  slug: string;
  title: string;
  url: string;
  type: string;
  /** First entry becomes the primary topic. */
  topics: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  description: string;
  summary?: string;
  whyItMatters?: string;
  keyTakeaways?: string[];
  whatYouLearn?: string[];
  prerequisites?: string[];
  bestFor?: string[];
  authorName?: string;
  organizationName?: string;
  language?: string;
  priceModel?: "free" | "freemium" | "paid";
  estimatedMinutes?: number;
  publishedAt?: string;
  isOfficial?: boolean;
  hasCode?: boolean;
  isEditorPick?: boolean;
  editorNote?: string;
  qualityScore: number;
  editorScore?: number;
  communityScore?: number;
  ratingsCount?: number;
  views: number;
  saves: number;
  clicks?: number;
  completions?: number;
  /** Relative popularity momentum, 0–1; drives the seeded trending curve. */
  momentum?: number;
  metadata?: Record<string, unknown>;
};

export type SeedPath = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  audience: string[];
  outcomes: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedWeeks: number;
  icon: string;
  accent: string;
  category: string;
  isPopular?: boolean;
  learnersCount: number;
  stages: Array<{
    title: string;
    description: string;
    estimatedWeeks?: number;
    resources: string[];
  }>;
};

export type SeedRelation = {
  from: string;
  to: string;
  relation: "related_to" | "prerequisite_of" | "next_step" | "implements" | "explains" | "alternative_to";
  weight?: number;
};

export type SeedUser = {
  username: string;
  email: string;
  displayName: string;
  password: string;
  role: "user" | "contributor" | "editor" | "admin";
  headline?: string;
  bio?: string;
  isTrusted?: boolean;
};

export type SeedReview = {
  resource: string;
  user: string;
  rating: number;
  body: string;
};
