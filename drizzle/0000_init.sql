CREATE TYPE "public"."difficulty" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."learning_state" AS ENUM('saved', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."price_model" AS ENUM('free', 'freemium', 'paid');--> statement-breakpoint
CREATE TYPE "public"."relation_type" AS ENUM('related_to', 'prerequisite_of', 'next_step', 'implements', 'explains', 'alternative_to');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."resource_status" AS ENUM('draft', 'processing', 'review', 'published', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('submitted', 'fetching', 'analyzing', 'duplicate_check', 'ready_for_review', 'approved', 'rejected', 'published', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'contributor', 'editor', 'admin');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('public', 'unlisted', 'private');--> statement-breakpoint
CREATE TABLE "ai_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid,
	"resource_id" uuid,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"analysis" jsonb NOT NULL,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"cost_usd" numeric(10, 6),
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"user_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"state" "learning_state" DEFAULT 'saved' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "bookmarks_user_id_resource_id_pk" PRIMARY KEY("user_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE "editorial_picks" (
	"resource_id" uuid PRIMARY KEY NOT NULL,
	"curator_id" uuid,
	"note" text,
	"rank" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_path_resources" (
	"stage_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_optional" boolean DEFAULT false NOT NULL,
	"note" text,
	CONSTRAINT "learning_path_resources_stage_id_resource_id_pk" PRIMARY KEY("stage_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE "learning_path_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"estimated_weeks" integer,
	CONSTRAINT "learning_path_stages_position_key" UNIQUE("path_id","position")
);
--> statement-breakpoint
CREATE TABLE "learning_paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"description" text,
	"audience" text[],
	"outcomes" text[],
	"difficulty" "difficulty" DEFAULT 'intermediate' NOT NULL,
	"estimated_weeks" integer,
	"icon" text DEFAULT 'route' NOT NULL,
	"accent" text DEFAULT 'indigo' NOT NULL,
	"category" text DEFAULT 'career' NOT NULL,
	"is_popular" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"learners_count" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learning_paths_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "path_enrollments" (
	"user_id" uuid NOT NULL,
	"path_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "path_enrollments_user_id_path_id_pk" PRIMARY KEY("user_id","path_id")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"bio" text,
	"headline" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"is_trusted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "related_topics" (
	"topic_id" uuid NOT NULL,
	"related_topic_id" uuid NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	CONSTRAINT "related_topics_topic_id_related_topic_id_pk" PRIMARY KEY("topic_id","related_topic_id")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid,
	"reported_by" uuid,
	"reason" text NOT NULL,
	"detail" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_daily_stats" (
	"resource_id" uuid NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"saves" integer DEFAULT 0 NOT NULL,
	"completions" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "resource_daily_stats_resource_id_day_pk" PRIMARY KEY("resource_id","day")
);
--> statement-breakpoint
CREATE TABLE "resource_embeddings" (
	"resource_id" uuid PRIMARY KEY NOT NULL,
	"embedding" vector(384) NOT NULL,
	"model" text NOT NULL,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_name" text NOT NULL,
	"user_id" uuid,
	"resource_id" uuid,
	"topic_id" uuid,
	"path_id" uuid,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_relations" (
	"from_resource_id" uuid NOT NULL,
	"to_resource_id" uuid NOT NULL,
	"relation" "relation_type" NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"created_by" uuid,
	CONSTRAINT "resource_relations_from_resource_id_to_resource_id_relation_pk" PRIMARY KEY("from_resource_id","to_resource_id","relation")
);
--> statement-breakpoint
CREATE TABLE "resource_topics" (
	"resource_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"relevance" real DEFAULT 1 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "resource_topics_resource_id_topic_id_pk" PRIMARY KEY("resource_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "resource_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"plural_name" text NOT NULL,
	"icon" text DEFAULT 'file-text' NOT NULL,
	"accent" text DEFAULT 'indigo' NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_primary_nav" boolean DEFAULT false NOT NULL,
	CONSTRAINT "resource_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"canonical_url" text NOT NULL,
	"url_hash" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"summary" text,
	"why_it_matters" text,
	"key_takeaways" text[],
	"what_you_learn" text[],
	"prerequisites" text[],
	"best_for" text[],
	"resource_type_id" uuid NOT NULL,
	"difficulty" "difficulty" DEFAULT 'intermediate' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"price_model" "price_model" DEFAULT 'free' NOT NULL,
	"estimated_minutes" integer,
	"author_name" text,
	"organization_name" text,
	"is_official" boolean DEFAULT false NOT NULL,
	"has_code" boolean DEFAULT false NOT NULL,
	"thumbnail_url" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"source_updated_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"status" "resource_status" DEFAULT 'draft' NOT NULL,
	"visibility" "visibility" DEFAULT 'public' NOT NULL,
	"quality_score" numeric(5, 2) DEFAULT '0' NOT NULL,
	"editor_score" numeric(5, 2),
	"community_score" numeric(3, 2),
	"trending_score" real DEFAULT 0 NOT NULL,
	"is_editor_pick" boolean DEFAULT false NOT NULL,
	"views_count" integer DEFAULT 0 NOT NULL,
	"clicks_count" integer DEFAULT 0 NOT NULL,
	"saves_count" integer DEFAULT 0 NOT NULL,
	"completions_count" integer DEFAULT 0 NOT NULL,
	"ratings_count" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(author_name, '') || ' ' || coalesce(organization_name, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(description, '')), 'C') ||
          setweight(to_tsvector('english', coalesce(summary, '') || ' ' || coalesce(why_it_matters, '')), 'D')) STORED,
	CONSTRAINT "resources_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"body" text,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_user_resource_key" UNIQUE("resource_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "search_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"normalized_query" text NOT NULL,
	"user_id" uuid,
	"results_count" integer DEFAULT 0 NOT NULL,
	"clicked_resource_id" uuid,
	"mode" text DEFAULT 'hybrid' NOT NULL,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"status" text NOT NULL,
	"message" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"reviewer_id" uuid,
	"decision" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"canonical_url" text,
	"url_hash" text,
	"note" text,
	"submitted_by" uuid,
	"status" "submission_status" DEFAULT 'submitted' NOT NULL,
	"draft" jsonb,
	"resource_id" uuid,
	"duplicate_of_id" uuid,
	"duplicate_similarity" real,
	"risk_level" text DEFAULT 'low' NOT NULL,
	"error_message" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic_daily_stats" (
	"topic_id" uuid NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"searches" integer DEFAULT 0 NOT NULL,
	"attention" real DEFAULT 0 NOT NULL,
	CONSTRAINT "topic_daily_stats_topic_id_day_pk" PRIMARY KEY("topic_id","day")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"tagline" text,
	"description" text,
	"parent_id" uuid,
	"icon" text DEFAULT 'sparkles' NOT NULL,
	"accent" text DEFAULT 'indigo' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topics_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_picks" ADD CONSTRAINT "editorial_picks_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_picks" ADD CONSTRAINT "editorial_picks_curator_id_profiles_id_fk" FOREIGN KEY ("curator_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_path_resources" ADD CONSTRAINT "learning_path_resources_stage_id_learning_path_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."learning_path_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_path_resources" ADD CONSTRAINT "learning_path_resources_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_path_stages" ADD CONSTRAINT "learning_path_stages_path_id_learning_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "path_enrollments" ADD CONSTRAINT "path_enrollments_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "path_enrollments" ADD CONSTRAINT "path_enrollments_path_id_learning_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "related_topics" ADD CONSTRAINT "related_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "related_topics" ADD CONSTRAINT "related_topics_related_topic_id_topics_id_fk" FOREIGN KEY ("related_topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_by_profiles_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_daily_stats" ADD CONSTRAINT "resource_daily_stats_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_embeddings" ADD CONSTRAINT "resource_embeddings_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_events" ADD CONSTRAINT "resource_events_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_events" ADD CONSTRAINT "resource_events_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_events" ADD CONSTRAINT "resource_events_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_events" ADD CONSTRAINT "resource_events_path_id_learning_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_relations" ADD CONSTRAINT "resource_relations_from_resource_id_resources_id_fk" FOREIGN KEY ("from_resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_relations" ADD CONSTRAINT "resource_relations_to_resource_id_resources_id_fk" FOREIGN KEY ("to_resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_relations" ADD CONSTRAINT "resource_relations_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_topics" ADD CONSTRAINT "resource_topics_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_topics" ADD CONSTRAINT "resource_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_resource_type_id_resource_types_id_fk" FOREIGN KEY ("resource_type_id") REFERENCES "public"."resource_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_queries" ADD CONSTRAINT "search_queries_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_queries" ADD CONSTRAINT "search_queries_clicked_resource_id_resources_id_fk" FOREIGN KEY ("clicked_resource_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_events" ADD CONSTRAINT "submission_events_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_reviews" ADD CONSTRAINT "submission_reviews_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_reviews" ADD CONSTRAINT "submission_reviews_reviewer_id_profiles_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_submitted_by_profiles_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_duplicate_of_id_resources_id_fk" FOREIGN KEY ("duplicate_of_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_daily_stats" ADD CONSTRAINT "topic_daily_stats_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_analyses_resource_idx" ON "ai_analyses" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "bookmarks_resource_idx" ON "bookmarks" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "bookmarks_state_idx" ON "bookmarks" USING btree ("user_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_username_key" ON "profiles" USING btree (lower("username"));--> statement-breakpoint
CREATE INDEX "resource_embeddings_hnsw_idx" ON "resource_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "resource_events_name_idx" ON "resource_events" USING btree ("event_name","created_at");--> statement-breakpoint
CREATE INDEX "resource_events_resource_idx" ON "resource_events" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "resource_relations_to_idx" ON "resource_relations" USING btree ("to_resource_id");--> statement-breakpoint
CREATE INDEX "resource_topics_topic_idx" ON "resource_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "resources_fts_idx" ON "resources" USING gin ("search_vector");--> statement-breakpoint
CREATE UNIQUE INDEX "resources_url_hash_key" ON "resources" USING btree ("url_hash");--> statement-breakpoint
CREATE INDEX "resources_status_idx" ON "resources" USING btree ("status","visibility");--> statement-breakpoint
CREATE INDEX "resources_type_idx" ON "resources" USING btree ("resource_type_id");--> statement-breakpoint
CREATE INDEX "resources_trending_idx" ON "resources" USING btree ("trending_score");--> statement-breakpoint
CREATE INDEX "resources_quality_idx" ON "resources" USING btree ("quality_score");--> statement-breakpoint
CREATE INDEX "resources_published_idx" ON "resources" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "reviews_resource_idx" ON "reviews" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "search_queries_normalized_idx" ON "search_queries" USING btree ("normalized_query");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "submission_events_submission_idx" ON "submission_events" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "submissions_status_idx" ON "submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "submissions_user_idx" ON "submissions" USING btree ("submitted_by");--> statement-breakpoint
CREATE INDEX "topics_parent_idx" ON "topics" USING btree ("parent_id");