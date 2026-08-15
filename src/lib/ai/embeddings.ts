import { createHash } from "node:crypto";

export const EMBEDDING_DIMENSIONS = 384;

const STOPWORDS = new Set([
  "a","an","and","are","as","at","be","by","for","from","has","he","in","is","it","its","of","on","that","the","to","was","were","will","with","this","these","those","you","your","their","them","we","our","us","i","how","what","why","when","which","who","can","could","should","would","do","does","did","not","but","or","if","then","than","so","such","into","about","over","under","more","most","other","some","any","all","also","using","use","used","via","new",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5+#.\s-]/g, " ")
    .split(/[\s\-_.]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function bucket(term: string): number {
  const digest = createHash("sha1").update(term).digest();
  return digest.readUInt32BE(0) % EMBEDDING_DIMENSIONS;
}

/** Signed hashing keeps unrelated terms from systematically reinforcing. */
function sign(term: string): number {
  return createHash("sha1").update(`sign:${term}`).digest()[0] % 2 === 0 ? 1 : -1;
}

/**
 * Deterministic, dependency-free embedding: hashed uni- and bi-grams with
 * sub-linear term weighting, L2-normalised.
 *
 * This is a lexical embedding, not a semantic one — it will match paraphrases
 * that share vocabulary but not true synonyms. It exists so that hybrid search,
 * duplicate detection and "related resources" are fully functional offline with
 * zero API keys; set `AI_PROVIDER=openai` to swap in real semantic vectors
 * without touching any calling code.
 */
export function localEmbedding(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const tokens = tokenize(text);
  const counts = new Map<string, number>();

  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]}~${tokens[i + 1]}`;
    counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
  }

  for (const [term, count] of counts) {
    const weight = (1 + Math.log(count)) * (term.includes("~") ? 0.6 : 1);
    vector[bucket(term)] += weight * sign(term);
  }

  return normalize(vector);
}

export function normalize(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) return vector;
  return vector.map((value) => value / magnitude);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/** Text used to embed a resource. Kept in one place so re-embedding is consistent. */
export function resourceEmbeddingInput(input: {
  title: string;
  description?: string | null;
  summary?: string | null;
  whyItMatters?: string | null;
  topics?: string[];
  authorName?: string | null;
  organizationName?: string | null;
  whatYouLearn?: string[] | null;
}): string {
  return [
    input.title,
    input.title, // title carries more signal, so it is counted twice
    (input.topics ?? []).join(" "),
    input.authorName ?? "",
    input.organizationName ?? "",
    input.description ?? "",
    input.summary ?? "",
    input.whyItMatters ?? "",
    (input.whatYouLearn ?? []).join(" "),
  ]
    .filter(Boolean)
    .join("\n");
}

export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

/** Postgres `vector` literal format. */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.map((v) => v.toFixed(6)).join(",")}]`;
}
