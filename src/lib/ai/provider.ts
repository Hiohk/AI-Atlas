import type { CrawlResult } from "../crawler/fetch-url";
import { localEmbedding, normalize } from "./embeddings";
import { heuristicAnalysis } from "./heuristics";
import { RESOURCE_ANALYSIS_JSON_SCHEMA, resourceAnalysisSchema, type ResourceAnalysis } from "./schema";

export type AnalysisRequest = {
  crawl: CrawlResult;
  knownTopicSlugs: string[];
};

export type AnalysisResult = {
  analysis: ResourceAnalysis;
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs: number;
};

/**
 * Business code calls `analyzeResource` / `embed`, never a vendor SDK. Swapping
 * or A/B-testing models, or falling back when one is down, is a provider-level
 * concern that callers never see.
 */
export interface AIProvider {
  readonly name: string;
  readonly model: string;
  /**
   * Cosine similarity below which a vector match is treated as noise. Every
   * embedding space has its own scale, so the threshold belongs to the provider
   * rather than to the search code: without it a nearest-neighbour query happily
   * returns the whole corpus for a nonsense term.
   */
  readonly similarityFloor: number;
  analyzeResource(request: AnalysisRequest): Promise<AnalysisResult>;
  embed(texts: string[]): Promise<number[][]>;
}

const SYSTEM_PROMPT = `You are the cataloguing engine for AI Atlas, a curated map of AI learning resources.
Given a fetched web document, produce a precise, factual catalogue record.

Rules:
- Never invent authors, dates, or claims that are not supported by the document.
- "whyItMatters" explains why a practitioner should spend time on this specific resource (2-3 sentences, no marketing language).
- "whatYouLearn" lists concrete capabilities the reader gains, not topics.
- "prerequisites" are things to understand BEFORE this resource.
- Choose topics only from the provided taxonomy. Omit rather than guess.
- qualityScore weighs authority, technical depth, originality and freshness. Be a harsh grader: 90+ is reserved for field-defining work.
- Set isSpam for promotional content, SEO farms, or anything not genuinely educational.`;

/** Zero-dependency provider: full pipeline behaviour with no API key. */
export class MockProvider implements AIProvider {
  readonly name = "mock";
  readonly model = "heuristic-v1";
  // Measured against the seed corpus: on-topic queries peak at 0.22–0.34 and
  // off-topic ones never clear 0.13, so 0.15 separates signal from noise.
  readonly similarityFloor = 0.15;

  async analyzeResource({ crawl, knownTopicSlugs }: AnalysisRequest): Promise<AnalysisResult> {
    const startedAt = Date.now();
    const analysis = resourceAnalysisSchema.parse(heuristicAnalysis(crawl, knownTopicSlugs));
    return { analysis, provider: this.name, model: this.model, latencyMs: Date.now() - startedAt };
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => localEmbedding(text));
  }
}

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  readonly model: string;
  // text-embedding-3 puts unrelated pairs around 0.1–0.3 and related ones above 0.5.
  readonly similarityFloor = 0.35;
  private readonly embeddingModel: string;

  constructor(
    private readonly apiKey: string,
    model = process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    embeddingModel = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    private readonly baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  ) {
    this.model = model;
    this.embeddingModel = embeddingModel;
  }

  async analyzeResource({ crawl, knownTopicSlugs }: AnalysisRequest): Promise<AnalysisResult> {
    const startedAt = Date.now();
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(crawl, knownTopicSlugs) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "resource_analysis", strict: true, schema: RESOURCE_ANALYSIS_JSON_SCHEMA },
        },
      }),
    });

    if (!response.ok) throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const payload = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    // Structured output still gets validated: a schema-conforming response can
    // hold values our domain rejects, and trust boundaries beat vendor promises.
    const analysis = resourceAnalysisSchema.parse(JSON.parse(payload.choices[0].message.content));

    return {
      analysis,
      provider: this.name,
      model: this.model,
      promptTokens: payload.usage?.prompt_tokens,
      completionTokens: payload.usage?.completion_tokens,
      latencyMs: Date.now() - startedAt,
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.embeddingModel, input: texts, dimensions: 384 }),
    });
    if (!response.ok) throw new Error(`OpenAI embeddings ${response.status}`);
    const payload = (await response.json()) as { data: Array<{ embedding: number[] }> };
    return payload.data.map((item) => normalize(item.embedding));
  }
}

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  readonly model: string;
  // Vectors come from `localEmbedding` below, so the local scale applies.
  readonly similarityFloor = 0.15;

  constructor(
    private readonly apiKey: string,
    model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
    private readonly baseUrl = process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com/v1",
  ) {
    this.model = model;
  }

  async analyzeResource({ crawl, knownTopicSlugs }: AnalysisRequest): Promise<AnalysisResult> {
    const startedAt = Date.now();
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        // A forced tool call is how this API returns guaranteed-shape JSON.
        tool_choice: { type: "tool", name: "record_resource" },
        tools: [
          {
            name: "record_resource",
            description: "Record the catalogue entry for the analysed resource.",
            input_schema: RESOURCE_ANALYSIS_JSON_SCHEMA,
          },
        ],
        messages: [{ role: "user", content: buildUserPrompt(crawl, knownTopicSlugs) }],
      }),
    });

    if (!response.ok) throw new Error(`Anthropic ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const payload = (await response.json()) as {
      content: Array<{ type: string; name?: string; input?: unknown }>;
      usage?: { input_tokens: number; output_tokens: number };
    };
    const toolUse = payload.content.find((block) => block.type === "tool_use");
    if (!toolUse?.input) throw new Error("Anthropic response did not include the expected tool call.");

    return {
      analysis: resourceAnalysisSchema.parse(toolUse.input),
      provider: this.name,
      model: this.model,
      promptTokens: payload.usage?.input_tokens,
      completionTokens: payload.usage?.output_tokens,
      latencyMs: Date.now() - startedAt,
    };
  }

  /** No embedding endpoint on this vendor; keep vectors consistent locally. */
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => localEmbedding(text));
  }
}

/**
 * Wraps a primary provider so that a vendor outage degrades to rule-based
 * analysis instead of failing the submission. The fallback marks its own output
 * with low confidence, so those records stay in the human review queue.
 */
export class FallbackProvider implements AIProvider {
  readonly name: string;
  readonly model: string;
  readonly similarityFloor: number;

  constructor(
    private readonly primary: AIProvider,
    private readonly backup: AIProvider = new MockProvider(),
  ) {
    this.name = primary.name;
    this.model = primary.model;
    // Either provider may have produced the stored vectors, so take the more
    // permissive floor: too many results is recoverable, silently zero is not.
    this.similarityFloor = Math.min(primary.similarityFloor, backup.similarityFloor);
  }

  async analyzeResource(request: AnalysisRequest): Promise<AnalysisResult> {
    try {
      return await this.primary.analyzeResource(request);
    } catch (error) {
      console.error(`[ai] ${this.primary.name} analysis failed, using ${this.backup.name}:`, (error as Error).message);
      const result = await this.backup.analyzeResource(request);
      return { ...result, provider: `${this.backup.name} (fallback from ${this.primary.name})` };
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    try {
      return await this.primary.embed(texts);
    } catch (error) {
      console.error(`[ai] ${this.primary.name} embedding failed, using ${this.backup.name}:`, (error as Error).message);
      return this.backup.embed(texts);
    }
  }
}

function buildUserPrompt(crawl: CrawlResult, knownTopicSlugs: string[]): string {
  return [
    `URL: ${crawl.canonicalUrl}`,
    `Site: ${crawl.siteName ?? "unknown"}`,
    `Title: ${crawl.title}`,
    `Meta description: ${crawl.description ?? "none"}`,
    `Author: ${crawl.author ?? "unknown"}`,
    `Published: ${crawl.publishedAt?.toISOString() ?? "unknown"}`,
    `Contains code samples: ${crawl.hasCode}`,
    "",
    `Allowed topic slugs: ${knownTopicSlugs.join(", ")}`,
    "",
    "Document text (truncated):",
    crawl.text.slice(0, 12_000),
  ].join("\n");
}

let cached: AIProvider | undefined;

/** Selected by `AI_PROVIDER`; defaults to mock so the app runs with no secrets. */
export function getAIProvider(): AIProvider {
  if (cached) return cached;

  const requested = (process.env.AI_PROVIDER ?? "mock").toLowerCase();
  if (requested === "openai" && process.env.OPENAI_API_KEY) {
    cached = new FallbackProvider(new OpenAIProvider(process.env.OPENAI_API_KEY));
  } else if (requested === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    cached = new FallbackProvider(new AnthropicProvider(process.env.ANTHROPIC_API_KEY));
  } else {
    if (requested !== "mock") {
      console.warn(`[ai] AI_PROVIDER=${requested} but no API key found; falling back to the mock provider.`);
    }
    cached = new MockProvider();
  }
  return cached;
}
