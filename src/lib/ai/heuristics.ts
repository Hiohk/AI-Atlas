import type { CrawlResult } from "../crawler/fetch-url";
import { DIFFICULTIES, RESOURCE_TYPE_SLUGS, type ResourceAnalysis } from "./schema";

type TypeSlug = (typeof RESOURCE_TYPE_SLUGS)[number];

const TYPE_RULES: Array<{ type: TypeSlug; test: (url: URL, text: string) => boolean }> = [
  { type: "paper", test: (u) => /(^|\.)arxiv\.org$/.test(u.hostname) || /\/(abs|pdf)\//.test(u.pathname) },
  { type: "paper", test: (u) => /(^|\.)(openreview\.net|aclanthology\.org|nature\.com|doi\.org)$/.test(u.hostname) },
  { type: "github", test: (u) => /(^|\.)github\.com$/.test(u.hostname) && u.pathname.split("/").filter(Boolean).length >= 2 },
  { type: "video", test: (u) => /(^|\.)(youtube\.com|youtu\.be|vimeo\.com)$/.test(u.hostname) },
  { type: "course", test: (u) => /(^|\.)(coursera\.org|deeplearning\.ai|udemy\.com|edx\.org|fast\.ai|maven\.com)$/.test(u.hostname) },
  { type: "dataset", test: (u) => /huggingface\.co$/.test(u.hostname) && u.pathname.startsWith("/datasets") },
  { type: "benchmark", test: (_u, t) => /\bbenchmark|leaderboard\b/.test(t) },
  { type: "documentation", test: (u) => /^docs?\./.test(u.hostname) || /\/(docs|documentation|reference)\//.test(u.pathname) },
  { type: "newsletter", test: (u) => /substack\.com$/.test(u.hostname) || /newsletter/.test(u.pathname) },
  { type: "podcast", test: (u, t) => /podcast/.test(u.hostname + u.pathname) || /\bpodcast episode\b/.test(t) },
  { type: "book", test: (u, t) => /\bbook\b/.test(u.pathname) || /\b(chapter \d|isbn)\b/.test(t) },
  { type: "tutorial", test: (_u, t) => /\b(tutorial|step[- ]by[- ]step|walkthrough|how to build)\b/.test(t) },
  { type: "blog", test: (u) => /(^|\.)(medium\.com|dev\.to|hashnode)/.test(u.hostname) || /\/(blog|posts?)\//.test(u.pathname) },
];

/** Domains whose content is, on average, authoritative for AI engineering. */
const AUTHORITY: Array<[RegExp, number]> = [
  [/arxiv\.org|openai\.com|anthropic\.com|deepmind\.google|ai\.meta\.com|research\.google/, 95],
  [/pytorch\.org|tensorflow\.org|huggingface\.co|nvidia\.com|modal\.com|vllm\.ai/, 90],
  [/deeplearning\.ai|fast\.ai|stanford\.edu|berkeley\.edu|mit\.edu|cmu\.edu/, 92],
  [/github\.com|langchain\.com|llamaindex\.ai|weaviate\.io|pinecone\.io/, 82],
  [/karpathy\.|lilianweng\.github\.io|jalammar\.github\.io|simonwillison\.net|eugeneyan\.com/, 90],
  [/youtube\.com|youtu\.be/, 70],
  [/medium\.com|substack\.com|dev\.to/, 60],
];

const TOPIC_KEYWORDS: Record<string, string[]> = {
  llm: ["llm", "large language model", "gpt", "language model", "claude", "llama", "mistral"],
  transformer: ["transformer", "attention", "self-attention", "positional encoding"],
  "pre-training": ["pretraining", "pre-training", "scaling law", "tokenizer", "next token"],
  "fine-tuning": ["fine-tuning", "finetune", "lora", "qlora", "peft", "sft", "instruction tuning"],
  alignment: ["alignment", "rlhf", "dpo", "preference", "reward model", "constitutional"],
  reasoning: ["reasoning", "chain of thought", "chain-of-thought", "test-time compute", "o1", "deliberate"],
  moe: ["mixture of experts", "moe", "sparse expert", "router"],
  inference: ["inference", "kv cache", "quantization", "throughput", "latency", "vllm", "serving", "speculative decoding"],
  evaluation: ["eval", "evaluation", "benchmark", "leaderboard", "mmlu", "judge"],
  "long-context": ["long context", "context window", "context length", "rope", "needle in a haystack"],
  prompting: ["prompt", "prompting", "prompt engineering", "few-shot", "system prompt"],
  rag: ["rag", "retrieval augmented", "retrieval-augmented", "vector search", "embedding search", "reranker", "chunking"],
  agents: ["agent", "agentic", "tool use", "function calling", "multi-agent", "autonomous", "mcp"],
  "agent-memory": ["memory", "long-term memory", "scratchpad", "episodic"],
  "ai-engineering": ["production", "deploy", "observability", "mlops", "llmops", "pipeline", "cost", "guardrail"],
  "ai-coding": ["copilot", "cursor", "code generation", "codegen", "swe-bench", "coding agent", "code assistant"],
  multimodal: ["multimodal", "vision language", "vlm", "audio", "speech", "image generation", "diffusion"],
  "computer-vision": ["computer vision", "detection", "segmentation", "cnn", "resnet", "vit"],
  robotics: ["robot", "robotics", "manipulation", "embodied", "vla"],
  "ai-safety": ["safety", "interpretability", "jailbreak", "red team", "misuse", "alignment risk"],
  "ai-infrastructure": ["gpu", "cuda", "distributed training", "kubernetes", "cluster", "triton", "flash attention"],
  "ai-fundamentals": ["neural network", "backpropagation", "gradient descent", "machine learning basics", "linear algebra"],
  "ai-product": ["product", "ux", "user experience", "pricing", "go to market", "design"],
  "ai-research": ["we propose", "state of the art", "sota", "ablation", "novel architecture"],
  "ai-tools": ["tool", "framework", "library", "sdk", "playground"],
};

const SPAM_SIGNALS = [
  /\b(casino|betting|forex|crypto giveaway|airdrop|nft mint)\b/i,
  /\b(buy now|limited offer|click here to win|make \$\d+ per)\b/i,
  /\b(essay writing service|paper writing service)\b/i,
];

const BEGINNER_MARKERS = ["introduction", "intro to", "getting started", "beginner", "basics", "101", "for dummies", "from scratch for"];
const ADVANCED_MARKERS = ["theorem", "proof", "ablation", "cuda kernel", "sota", "state of the art", "distributed training", "custom kernel", "assembly", "internals"];

/**
 * Rule-based resource analysis.
 *
 * Powers `MockProvider`, so the whole ingestion pipeline — classification,
 * topic extraction, difficulty, quality scoring, spam screening — runs with no
 * API key. It is also the fallback when a real provider errors, which keeps
 * submissions flowing during an outage instead of dead-lettering them.
 */
export function heuristicAnalysis(crawl: CrawlResult, knownTopicSlugs: string[]): ResourceAnalysis {
  const url = new URL(crawl.canonicalUrl);
  const haystack = `${crawl.title} ${crawl.description ?? ""} ${crawl.text.slice(0, 8000)}`.toLowerCase();

  const type = detectType(url, haystack, crawl);
  const topics = detectTopics(haystack, knownTopicSlugs);
  const difficulty = detectDifficulty(haystack, type);
  const authority = authorityScore(url.hostname);
  const words = crawl.text.split(/\s+/).filter(Boolean).length;
  const isSpam = SPAM_SIGNALS.some((rx) => rx.test(haystack));

  const technicalDepth = clamp(
    30 + Math.min(40, words / 120) + (crawl.hasCode ? 15 : 0) + (type === "paper" ? 15 : 0),
  );
  const freshness = freshnessScore(crawl.publishedAt);
  const originality = clamp(authority * 0.5 + (type === "paper" || type === "github" ? 40 : 25));
  const qualityScore = Math.round(
    authority * 0.28 + technicalDepth * 0.28 + originality * 0.22 + freshness * 0.22,
  );

  return {
    type,
    title: crawl.title.slice(0, 300) || url.hostname,
    description: (crawl.description || crawl.text.slice(0, 280) || `Resource from ${url.hostname}`).slice(0, 600),
    summary: crawl.text.slice(0, 600) || undefined,
    whyItMatters: undefined,
    keyTakeaways: [],
    whatYouLearn: [],
    prerequisites: difficulty === "advanced" ? ["Comfort with deep learning fundamentals"] : [],
    bestFor: bestForFromTopics(topics),
    topics,
    difficulty,
    language: /[\u4e00-\u9fa5]/.test(crawl.title + (crawl.description ?? "")) ? "zh" : "en",
    priceModel: /\b(pricing|subscribe|enroll for \$|\$\d+\/mo)\b/.test(haystack) ? "freemium" : "free",
    estimatedMinutes: estimateMinutes(type, words, crawl.videoDurationSeconds),
    authorName: crawl.author ?? null,
    organizationName: crawl.siteName ?? null,
    hasCode: crawl.hasCode,
    isOfficial: authority >= 88,
    qualityScore: isSpam ? 5 : qualityScore,
    qualityBreakdown: { authority, technicalDepth, originality, freshness },
    isSpam,
    spamReason: isSpam ? "Matched spam keyword patterns" : null,
    // Deliberately mid-confidence: rules classify well but cannot judge substance,
    // which is what keeps these submissions in the human review queue.
    confidence: 0.55,
  };
}

function detectType(url: URL, haystack: string, crawl: CrawlResult): TypeSlug {
  if (crawl.declaredType && (RESOURCE_TYPE_SLUGS as readonly string[]).includes(crawl.declaredType)) {
    return crawl.declaredType as TypeSlug;
  }
  for (const rule of TYPE_RULES) if (rule.test(url, haystack)) return rule.type;
  return "blog";
}

function detectTopics(haystack: string, knownTopicSlugs: string[]): string[] {
  const allowed = new Set(knownTopicSlugs);
  const scored: Array<{ slug: string; score: number }> = [];

  for (const [slug, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (allowed.size > 0 && !allowed.has(slug)) continue;
    let score = 0;
    for (const keyword of keywords) {
      const matches = haystack.split(keyword).length - 1;
      if (matches > 0) score += Math.min(4, matches) * (keyword.includes(" ") ? 1.5 : 1);
    }
    if (score > 0) scored.push({ slug, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((s) => s.slug);
}

function detectDifficulty(haystack: string, type: TypeSlug): (typeof DIFFICULTIES)[number] {
  if (BEGINNER_MARKERS.some((m) => haystack.includes(m))) return "beginner";
  const advanced = ADVANCED_MARKERS.filter((m) => haystack.includes(m)).length;
  if (advanced >= 2 || (type === "paper" && advanced >= 1)) return "advanced";
  return "intermediate";
}

function authorityScore(hostname: string): number {
  for (const [pattern, score] of AUTHORITY) if (pattern.test(hostname)) return score;
  return hostname.endsWith(".edu") || hostname.endsWith(".org") ? 70 : 50;
}

function freshnessScore(publishedAt: Date | null | undefined): number {
  if (!publishedAt) return 55;
  const months = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (months < 3) return 100;
  if (months < 12) return 85;
  if (months < 24) return 70;
  if (months < 48) return 55;
  return 40;
}

function estimateMinutes(type: TypeSlug, words: number, videoSeconds?: number | null): number | null {
  if (videoSeconds) return Math.max(1, Math.round(videoSeconds / 60));
  if (type === "course") return 600;
  if (type === "book") return 1200;
  if (words > 0) return Math.max(3, Math.round(words / 200));
  return null;
}

function bestForFromTopics(topics: string[]): string[] {
  const audiences = new Set<string>();
  if (topics.some((t) => ["ai-engineering", "inference", "rag", "agents", "ai-infrastructure"].includes(t))) audiences.add("AI Engineer");
  if (topics.some((t) => ["ai-research", "transformer", "alignment", "reasoning"].includes(t))) audiences.add("Researcher");
  if (topics.includes("ai-product")) audiences.add("Product Manager");
  if (topics.includes("ai-fundamentals")) audiences.add("Student");
  if (audiences.size === 0) audiences.add("AI Engineer");
  return [...audiences];
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}
