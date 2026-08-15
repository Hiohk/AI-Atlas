import { relations, sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/**
 * Dimensionality of every embedding in the system. 384 is the native size of
 * the small open sentence-transformer models and is also requestable from
 * OpenAI's text-embedding-3-* models, so providers stay swappable.
 */
export const EMBEDDING_DIMENSIONS = 384;

const tsvector = customType<{ data: string; driverData: string }>({
  dataType: () => "tsvector",
});

/* -------------------------------------------------------------------------- */
/*                                   Enums                                    */
/* -------------------------------------------------------------------------- */

export const userRoleEnum = pgEnum("user_role", ["user", "contributor", "editor", "admin"]);

export const difficultyEnum = pgEnum("difficulty", ["beginner", "intermediate", "advanced"]);

/** Resource lifecycle. Mirrors the state machine in the product spec. */
export const resourceStatusEnum = pgEnum("resource_status", [
  "draft",
  "processing",
  "review",
  "published",
  "rejected",
  "archived",
]);

export const visibilityEnum = pgEnum("visibility", ["public", "unlisted", "private"]);

export const priceModelEnum = pgEnum("price_model", ["free", "freemium", "paid"]);

/** Bookmark doubles as the learning-progress record for a resource. */
export const learningStateEnum = pgEnum("learning_state", ["saved", "in_progress", "completed"]);

/** Async pipeline stages for a user submission. */
export const submissionStatusEnum = pgEnum("submission_status", [
  "submitted",
  "fetching",
  "analyzing",
  "duplicate_check",
  "ready_for_review",
  "approved",
  "rejected",
  "published",
  "failed",
]);

/** Edge types of the knowledge graph. */
export const relationTypeEnum = pgEnum("relation_type", [
  "related_to",
  "prerequisite_of",
  "next_step",
  "implements",
  "explains",
  "alternative_to",
]);

export const reportStatusEnum = pgEnum("report_status", ["open", "resolved", "dismissed"]);

/* -------------------------------------------------------------------------- */
/*                             Identity & accounts                            */
/* -------------------------------------------------------------------------- */

/**
 * Named `profiles` (rather than `users`) to match the Supabase convention: if
 * auth is later delegated to Supabase Auth, `password_hash` is dropped and `id`
 * becomes a foreign key onto `auth.users`.
 */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    headline: text("headline"),
    role: userRoleEnum("role").notNull().default("user"),
    isTrusted: boolean("is_trusted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("profiles_email_key").on(sql`lower(${t.email})`), uniqueIndex("profiles_username_key").on(sql`lower(${t.username})`)],
);

export const sessions = pgTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/* -------------------------------------------------------------------------- */
/*                            Taxonomy: types & topics                        */
/* -------------------------------------------------------------------------- */

export const resourceTypes = pgTable("resource_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  pluralName: text("plural_name").notNull(),
  icon: text("icon").notNull().default("file-text"),
  accent: text("accent").notNull().default("indigo"),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  isPrimaryNav: boolean("is_primary_nav").notNull().default(false),
});

/**
 * Topics are first-class entities, not tags: they carry their own copy, own a
 * subtree of children, and act as landing pages for SEO.
 */
export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    shortName: text("short_name"),
    tagline: text("tagline"),
    description: text("description"),
    parentId: uuid("parent_id"),
    icon: text("icon").notNull().default("sparkles"),
    accent: text("accent").notNull().default("indigo"),
    sortOrder: integer("sort_order").notNull().default(0),
    isFeatured: boolean("is_featured").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("topics_parent_idx").on(t.parentId)],
);

export const relatedTopics = pgTable(
  "related_topics",
  {
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    relatedTopicId: uuid("related_topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    weight: real("weight").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.topicId, t.relatedTopicId] })],
);

/* -------------------------------------------------------------------------- */
/*                                  Resources                                 */
/* -------------------------------------------------------------------------- */

export const resources = pgTable(
  "resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),

    // Identity
    title: text("title").notNull(),
    url: text("url").notNull(),
    /** Normalised URL used for exact-duplicate detection (level 1 + 2). */
    canonicalUrl: text("canonical_url").notNull(),
    urlHash: text("url_hash").notNull(),

    // Content
    description: text("description").notNull().default(""),
    summary: text("summary"),
    whyItMatters: text("why_it_matters"),
    keyTakeaways: text("key_takeaways").array(),
    whatYouLearn: text("what_you_learn").array(),
    prerequisites: text("prerequisites").array(),
    bestFor: text("best_for").array(),

    // Classification
    resourceTypeId: uuid("resource_type_id")
      .notNull()
      .references(() => resourceTypes.id),
    difficulty: difficultyEnum("difficulty").notNull().default("intermediate"),
    language: text("language").notNull().default("en"),
    priceModel: priceModelEnum("price_model").notNull().default("free"),
    estimatedMinutes: integer("estimated_minutes"),

    // Provenance
    authorName: text("author_name"),
    organizationName: text("organization_name"),
    isOfficial: boolean("is_official").notNull().default(false),
    hasCode: boolean("has_code").notNull().default(false),
    thumbnailUrl: text("thumbnail_url"),
    /** Type-specific fields: conference, pages, pdfUrl, stars, videoDuration… */
    metadata: jsonb("metadata").$type<ResourceMetadata>().notNull().default({}),

    publishedAt: timestamp("published_at", { withTimezone: true }),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),

    // Lifecycle
    status: resourceStatusEnum("status").notNull().default("draft"),
    visibility: visibilityEnum("visibility").notNull().default("public"),

    // Quality & ranking
    qualityScore: numeric("quality_score", { precision: 5, scale: 2 }).notNull().default("0"),
    editorScore: numeric("editor_score", { precision: 5, scale: 2 }),
    communityScore: numeric("community_score", { precision: 3, scale: 2 }),
    trendingScore: real("trending_score").notNull().default(0),
    isEditorPick: boolean("is_editor_pick").notNull().default(false),

    // Denormalised counters, kept in sync by the stats service
    viewsCount: integer("views_count").notNull().default(0),
    clicksCount: integer("clicks_count").notNull().default(0),
    savesCount: integer("saves_count").notNull().default(0),
    completionsCount: integer("completions_count").notNull().default(0),
    ratingsCount: integer("ratings_count").notNull().default(0),

    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

    /**
     * Weighted full-text index. Title matches outrank body matches, which is
     * what makes keyword search feel precise without a separate search engine.
     */
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(author_name, '') || ' ' || coalesce(organization_name, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(description, '')), 'C') ||
          setweight(to_tsvector('english', coalesce(summary, '') || ' ' || coalesce(why_it_matters, '')), 'D')`,
    ),
  },
  (t) => [
    index("resources_fts_idx").using("gin", t.searchVector),
    uniqueIndex("resources_url_hash_key").on(t.urlHash),
    index("resources_status_idx").on(t.status, t.visibility),
    index("resources_type_idx").on(t.resourceTypeId),
    index("resources_trending_idx").on(t.trendingScore),
    index("resources_quality_idx").on(t.qualityScore),
    index("resources_published_idx").on(t.publishedAt),
  ],
);

export type ResourceMetadata = {
  conference?: string;
  year?: number;
  pages?: number;
  pdfUrl?: string;
  codeUrl?: string;
  license?: string;
  arxivId?: string;
  doi?: string;
  stars?: number;
  forks?: number;
  lessons?: number;
  videoDurationSeconds?: number;
  provider?: string;
  citations?: number;
  communityQuote?: { body: string; author: string };
  [key: string]: unknown;
};

export const resourceTopics = pgTable(
  "resource_topics",
  {
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    relevance: real("relevance").notNull().default(1),
    isPrimary: boolean("is_primary").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.resourceId, t.topicId] }), index("resource_topics_topic_idx").on(t.topicId)],
);

/** Directed edges of the knowledge graph, powering "before this / learn next". */
export const resourceRelations = pgTable(
  "resource_relations",
  {
    fromResourceId: uuid("from_resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    toResourceId: uuid("to_resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    relation: relationTypeEnum("relation").notNull(),
    weight: real("weight").notNull().default(1),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
  },
  (t) => [
    primaryKey({ columns: [t.fromResourceId, t.toResourceId, t.relation] }),
    index("resource_relations_to_idx").on(t.toResourceId),
  ],
);

export const resourceEmbeddings = pgTable(
  "resource_embeddings",
  {
    resourceId: uuid("resource_id")
      .primaryKey()
      .references(() => resources.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    model: text("model").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("resource_embeddings_hnsw_idx").using("hnsw", t.embedding.op("vector_cosine_ops"))],
);

/* -------------------------------------------------------------------------- */
/*                               Learning paths                               */
/* -------------------------------------------------------------------------- */

export const learningPaths = pgTable("learning_paths", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  description: text("description"),
  audience: text("audience").array(),
  outcomes: text("outcomes").array(),
  difficulty: difficultyEnum("difficulty").notNull().default("intermediate"),
  estimatedWeeks: integer("estimated_weeks"),
  icon: text("icon").notNull().default("route"),
  accent: text("accent").notNull().default("indigo"),
  category: text("category").notNull().default("career"),
  isPopular: boolean("is_popular").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(true),
  learnersCount: integer("learners_count").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const learningPathStages = pgTable(
  "learning_path_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pathId: uuid("path_id")
      .notNull()
      .references(() => learningPaths.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    estimatedWeeks: integer("estimated_weeks"),
  },
  (t) => [unique("learning_path_stages_position_key").on(t.pathId, t.position)],
);

export const learningPathResources = pgTable(
  "learning_path_resources",
  {
    stageId: uuid("stage_id")
      .notNull()
      .references(() => learningPathStages.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    isOptional: boolean("is_optional").notNull().default(false),
    note: text("note"),
  },
  (t) => [primaryKey({ columns: [t.stageId, t.resourceId] })],
);

export const pathEnrollments = pgTable(
  "path_enrollments",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    pathId: uuid("path_id")
      .notNull()
      .references(() => learningPaths.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.pathId] })],
);

/* -------------------------------------------------------------------------- */
/*                          User activity & community                         */
/* -------------------------------------------------------------------------- */

export const bookmarks = pgTable(
  "bookmarks",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    state: learningStateEnum("state").notNull().default("saved"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.resourceId] }),
    index("bookmarks_resource_idx").on(t.resourceId),
    index("bookmarks_state_idx").on(t.userId, t.state),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    body: text("body"),
    helpfulCount: integer("helpful_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("reviews_user_resource_key").on(t.resourceId, t.userId), index("reviews_resource_idx").on(t.resourceId)],
);

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  resourceId: uuid("resource_id").references(() => resources.id, { onDelete: "cascade" }),
  reportedBy: uuid("reported_by").references(() => profiles.id, { onDelete: "set null" }),
  reason: text("reason").notNull(),
  detail: text("detail"),
  status: reportStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------------------------- */
/*                        Submissions & moderation queue                      */
/* -------------------------------------------------------------------------- */

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url"),
    urlHash: text("url_hash"),
    note: text("note"),
    submittedBy: uuid("submitted_by").references(() => profiles.id, { onDelete: "set null" }),
    status: submissionStatusEnum("status").notNull().default("submitted"),
    /** Draft record the pipeline builds up; promoted to `resources` on approve. */
    draft: jsonb("draft").$type<Record<string, unknown>>(),
    resourceId: uuid("resource_id").references(() => resources.id, { onDelete: "set null" }),
    duplicateOfId: uuid("duplicate_of_id").references(() => resources.id, { onDelete: "set null" }),
    duplicateSimilarity: real("duplicate_similarity"),
    /** Set when the pipeline flags the item for mandatory human attention. */
    riskLevel: text("risk_level").notNull().default("low"),
    errorMessage: text("error_message"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("submissions_status_idx").on(t.status), index("submissions_user_idx").on(t.submittedBy)],
);

/** Append-only audit log of each pipeline step, for debugging and retries. */
export const submissionEvents = pgTable(
  "submission_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    stage: text("stage").notNull(),
    status: text("status").notNull(),
    message: text("message"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("submission_events_submission_idx").on(t.submissionId)],
);

export const submissionReviews = pgTable("submission_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id")
    .notNull()
    .references(() => submissions.id, { onDelete: "cascade" }),
  reviewerId: uuid("reviewer_id").references(() => profiles.id, { onDelete: "set null" }),
  decision: text("decision").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Persisted AI output so a resource is analysed once and reused by everyone. */
export const aiAnalyses = pgTable(
  "ai_analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id").references(() => submissions.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id").references(() => resources.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    /** Schema-validated payload. Never persist raw model prose. */
    analysis: jsonb("analysis").$type<Record<string, unknown>>().notNull(),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
    latencyMs: integer("latency_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_analyses_resource_idx").on(t.resourceId)],
);

export const editorialPicks = pgTable(
  "editorial_picks",
  {
    resourceId: uuid("resource_id")
      .primaryKey()
      .references(() => resources.id, { onDelete: "cascade" }),
    curatorId: uuid("curator_id").references(() => profiles.id, { onDelete: "set null" }),
    note: text("note"),
    rank: integer("rank").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

/* -------------------------------------------------------------------------- */
/*                                  Analytics                                 */
/* -------------------------------------------------------------------------- */

export const resourceEvents = pgTable(
  "resource_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventName: text("event_name").notNull(),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
    resourceId: uuid("resource_id").references(() => resources.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id").references(() => topics.id, { onDelete: "cascade" }),
    pathId: uuid("path_id").references(() => learningPaths.id, { onDelete: "cascade" }),
    sessionId: text("session_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("resource_events_name_idx").on(t.eventName, t.createdAt), index("resource_events_resource_idx").on(t.resourceId)],
);

/**
 * What users search for is a stronger product signal than what they click:
 * high-volume queries with no good results are the topic backlog.
 */
export const searchQueries = pgTable(
  "search_queries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    query: text("query").notNull(),
    normalizedQuery: text("normalized_query").notNull(),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
    resultsCount: integer("results_count").notNull().default(0),
    clickedResourceId: uuid("clicked_resource_id").references(() => resources.id, { onDelete: "set null" }),
    mode: text("mode").notNull().default("hybrid"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("search_queries_normalized_idx").on(t.normalizedQuery)],
);

/** Daily rollups; the trending algorithm reads growth from here, not raw events. */
export const resourceDailyStats = pgTable(
  "resource_daily_stats",
  {
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    views: integer("views").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    saves: integer("saves").notNull().default(0),
    completions: integer("completions").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.resourceId, t.day] })],
);

export const topicDailyStats = pgTable(
  "topic_daily_stats",
  {
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    views: integer("views").notNull().default(0),
    searches: integer("searches").notNull().default(0),
    attention: real("attention").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.topicId, t.day] })],
);

/* -------------------------------------------------------------------------- */
/*                             Relational mappings                            */
/* -------------------------------------------------------------------------- */

export const resourcesRelations = relations(resources, ({ one, many }) => ({
  type: one(resourceTypes, { fields: [resources.resourceTypeId], references: [resourceTypes.id] }),
  topics: many(resourceTopics),
  embedding: one(resourceEmbeddings, { fields: [resources.id], references: [resourceEmbeddings.resourceId] }),
  reviews: many(reviews),
  bookmarks: many(bookmarks),
  submitter: one(profiles, { fields: [resources.createdBy], references: [profiles.id] }),
}));

export const resourceTopicsRelations = relations(resourceTopics, ({ one }) => ({
  resource: one(resources, { fields: [resourceTopics.resourceId], references: [resources.id] }),
  topic: one(topics, { fields: [resourceTopics.topicId], references: [topics.id] }),
}));

export const topicsRelations = relations(topics, ({ one, many }) => ({
  parent: one(topics, { fields: [topics.parentId], references: [topics.id], relationName: "topic_parent" }),
  children: many(topics, { relationName: "topic_parent" }),
  resources: many(resourceTopics),
}));

export const learningPathsRelations = relations(learningPaths, ({ many }) => ({
  stages: many(learningPathStages),
  enrollments: many(pathEnrollments),
}));

export const learningPathStagesRelations = relations(learningPathStages, ({ one, many }) => ({
  path: one(learningPaths, { fields: [learningPathStages.pathId], references: [learningPaths.id] }),
  resources: many(learningPathResources),
}));

export const learningPathResourcesRelations = relations(learningPathResources, ({ one }) => ({
  stage: one(learningPathStages, { fields: [learningPathResources.stageId], references: [learningPathStages.id] }),
  resource: one(resources, { fields: [learningPathResources.resourceId], references: [resources.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  resource: one(resources, { fields: [reviews.resourceId], references: [resources.id] }),
  user: one(profiles, { fields: [reviews.userId], references: [profiles.id] }),
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  resource: one(resources, { fields: [bookmarks.resourceId], references: [resources.id] }),
  user: one(profiles, { fields: [bookmarks.userId], references: [profiles.id] }),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  submitter: one(profiles, { fields: [submissions.submittedBy], references: [profiles.id] }),
  duplicateOf: one(resources, { fields: [submissions.duplicateOfId], references: [resources.id] }),
  events: many(submissionEvents),
}));

export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;
export type Topic = typeof topics.$inferSelect;
export type ResourceType = typeof resourceTypes.$inferSelect;
export type LearningPath = typeof learningPaths.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type Difficulty = (typeof difficultyEnum.enumValues)[number];
export type LearningState = (typeof learningStateEnum.enumValues)[number];
export type UserRole = (typeof userRoleEnum.enumValues)[number];
