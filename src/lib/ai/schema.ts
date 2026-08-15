import { z } from "zod";

export const RESOURCE_TYPE_SLUGS = [
  "paper",
  "course",
  "tutorial",
  "github",
  "blog",
  "video",
  "book",
  "documentation",
  "newsletter",
  "podcast",
  "dataset",
  "benchmark",
  "tool",
  "ai-product",
] as const;

export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
export const PRICE_MODELS = ["free", "freemium", "paid"] as const;

/**
 * The contract between the model and the database.
 *
 * Model output is validated against this before it touches Postgres — the
 * pipeline never parses prose, and a malformed completion fails the job instead
 * of corrupting a record.
 */
export const resourceAnalysisSchema = z.object({
  type: z.enum(RESOURCE_TYPE_SLUGS),
  title: z.string().min(3).max(300),
  description: z.string().min(10).max(600),
  summary: z.string().max(1200).optional(),
  whyItMatters: z.string().max(1200).optional(),
  keyTakeaways: z.array(z.string().max(240)).max(6).default([]),
  whatYouLearn: z.array(z.string().max(240)).max(8).default([]),
  prerequisites: z.array(z.string().max(120)).max(8).default([]),
  bestFor: z.array(z.string().max(60)).max(6).default([]),
  /** Topic slugs; unknown values are dropped rather than auto-created. */
  topics: z.array(z.string().max(80)).max(8).default([]),
  difficulty: z.enum(DIFFICULTIES),
  language: z.string().min(2).max(8).default("en"),
  priceModel: z.enum(PRICE_MODELS).default("free"),
  estimatedMinutes: z.number().int().min(1).max(100_000).nullable().default(null),
  authorName: z.string().max(200).nullable().default(null),
  organizationName: z.string().max(200).nullable().default(null),
  hasCode: z.boolean().default(false),
  isOfficial: z.boolean().default(false),
  qualityScore: z.number().min(0).max(100),
  qualityBreakdown: z
    .object({
      authority: z.number().min(0).max(100),
      technicalDepth: z.number().min(0).max(100),
      originality: z.number().min(0).max(100),
      freshness: z.number().min(0).max(100),
    })
    .partial()
    .default({}),
  /** Anti-abuse signal: spam short-circuits the pipeline into the reject queue. */
  isSpam: z.boolean().default(false),
  spamReason: z.string().max(300).nullable().default(null),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type ResourceAnalysis = z.infer<typeof resourceAnalysisSchema>;

export const RESOURCE_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "type",
    "title",
    "description",
    "summary",
    "whyItMatters",
    "keyTakeaways",
    "whatYouLearn",
    "prerequisites",
    "bestFor",
    "topics",
    "difficulty",
    "language",
    "priceModel",
    "estimatedMinutes",
    "authorName",
    "organizationName",
    "hasCode",
    "isOfficial",
    "qualityScore",
    "isSpam",
    "spamReason",
    "confidence",
  ],
  properties: {
    type: { type: "string", enum: RESOURCE_TYPE_SLUGS },
    title: { type: "string" },
    description: { type: "string" },
    summary: { type: "string" },
    whyItMatters: { type: "string" },
    keyTakeaways: { type: "array", items: { type: "string" } },
    whatYouLearn: { type: "array", items: { type: "string" } },
    prerequisites: { type: "array", items: { type: "string" } },
    bestFor: { type: "array", items: { type: "string" } },
    topics: { type: "array", items: { type: "string" } },
    difficulty: { type: "string", enum: DIFFICULTIES },
    language: { type: "string" },
    priceModel: { type: "string", enum: PRICE_MODELS },
    estimatedMinutes: { type: ["integer", "null"] },
    authorName: { type: ["string", "null"] },
    organizationName: { type: ["string", "null"] },
    hasCode: { type: "boolean" },
    isOfficial: { type: "boolean" },
    qualityScore: { type: "number" },
    isSpam: { type: "boolean" },
    spamReason: { type: ["string", "null"] },
    confidence: { type: "number" },
  },
} as const;
