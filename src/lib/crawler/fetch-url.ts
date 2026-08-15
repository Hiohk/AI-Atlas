import { assertSafeUrl, canonicalizeUrl, UnsafeUrlError } from "./url";

export type CrawlResult = {
  url: string;
  canonicalUrl: string;
  title: string;
  description: string | null;
  siteName: string | null;
  author: string | null;
  publishedAt: Date | null;
  text: string;
  hasCode: boolean;
  thumbnailUrl: string | null;
  declaredType: string | null;
  videoDurationSeconds: number | null;
  metadata: Record<string, unknown>;
};

const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 12_000;
const USER_AGENT = "AIAtlasBot/0.1 (+https://ai-atlas.dev/about)";
const ALLOWED_CONTENT_TYPES = [/^text\/html/, /^text\/plain/, /^application\/xhtml\+xml/, /^application\/json/];

export class CrawlError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable = true) {
    super(message);
    this.name = "CrawlError";
    this.retryable = retryable;
  }
}

/**
 * Fetches a submitted URL under strict limits: every redirect hop is
 * re-validated against the SSRF rules, the body is capped mid-stream rather than
 * after the fact, and non-document content types are refused.
 */
export async function crawl(rawUrl: string): Promise<CrawlResult> {
  let current = rawUrl;
  let response: Response | null = null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const { url } = await assertSafeUrl(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5" },
      });
    } catch (error) {
      if (error instanceof UnsafeUrlError) throw error;
      throw new CrawlError(`Could not reach ${url.hostname}: ${(error as Error).message}`);
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new CrawlError("Redirect without a destination.", false);
      current = new URL(location, url).toString();
      continue;
    }
    break;
  }

  if (!response) throw new CrawlError("Too many redirects.", false);
  if (response.status === 429 || response.status >= 500) {
    throw new CrawlError(`Upstream returned ${response.status}.`, true);
  }
  if (!response.ok) throw new CrawlError(`Upstream returned ${response.status}.`, false);

  const contentType = response.headers.get("content-type") ?? "";
  if (!ALLOWED_CONTENT_TYPES.some((rx) => rx.test(contentType))) {
    throw new CrawlError(`Unsupported content type: ${contentType || "unknown"}.`, false);
  }

  const body = await readCapped(response);
  const finalUrl = response.url || current;
  const extracted = contentType.startsWith("application/json")
    ? extractFromJson(body, finalUrl)
    : extractFromHtml(body, finalUrl);

  return {
    ...extracted,
    url: finalUrl,
    canonicalUrl: canonicalizeUrl(extracted.canonicalUrl || finalUrl),
  };
}

async function readCapped(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) throw new CrawlError("Document is too large.", false);

  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder("utf-8");
  let received = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_BYTES) {
      await reader.cancel();
      break; // Prefix is enough to classify; no need to fail the submission.
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

type Extracted = Omit<CrawlResult, "url" | "canonicalUrl"> & { canonicalUrl: string };

function extractFromHtml(html: string, url: string): Extracted {
  const meta = (property: string) =>
    firstMatch(html, [
      new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`, "i"),
    ]);

  const jsonLd = extractJsonLd(html);
  const title =
    meta("og:title") ?? meta("twitter:title") ?? firstMatch(html, [/<title[^>]*>([\s\S]*?)<\/title>/i]) ?? "";
  const description = meta("og:description") ?? meta("twitter:description") ?? meta("description");
  const publishedRaw =
    meta("article:published_time") ?? meta("citation_publication_date") ?? (jsonLd?.datePublished as string | undefined);
  const durationRaw = meta("video:duration") ?? (jsonLd?.duration as string | undefined);

  const text = htmlToText(html);

  return {
    title: decodeEntities(title).trim().slice(0, 300),
    description: description ? decodeEntities(description).trim().slice(0, 600) : null,
    siteName: meta("og:site_name") ?? new URL(url).hostname.replace(/^www\./, ""),
    author: meta("author") ?? meta("citation_author") ?? (jsonLd?.author as string | undefined) ?? null,
    publishedAt: parseDate(publishedRaw),
    text,
    hasCode: /<pre[\s>]|<code[\s>]|class=["'][^"']*(highlight|language-)/i.test(html),
    thumbnailUrl: meta("og:image") ?? null,
    declaredType: mapOgType(meta("og:type")),
    videoDurationSeconds: parseDuration(durationRaw),
    canonicalUrl: firstMatch(html, [/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i]) ?? url,
    metadata: {
      ogType: meta("og:type") ?? null,
      arxivId: meta("citation_arxiv_id") ?? null,
      doi: meta("citation_doi") ?? null,
    },
  };
}

function extractFromJson(body: string, url: string): Extracted {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(body) as Record<string, unknown>;
  } catch {
    /* fall through to the empty shape below */
  }
  const pick = (...keys: string[]) => keys.map((k) => parsed[k]).find((v) => typeof v === "string") as string | undefined;

  return {
    title: (pick("title", "name", "full_name") ?? new URL(url).pathname.slice(1)).slice(0, 300),
    description: pick("description", "summary", "abstract")?.slice(0, 600) ?? null,
    siteName: new URL(url).hostname.replace(/^www\./, ""),
    author: pick("author", "owner") ?? null,
    publishedAt: parseDate(pick("created_at", "published_at", "datePublished")),
    text: [pick("description"), pick("readme"), pick("abstract")].filter(Boolean).join("\n"),
    hasCode: true,
    thumbnailUrl: pick("image", "avatar_url") ?? null,
    declaredType: null,
    videoDurationSeconds: null,
    canonicalUrl: pick("html_url", "url") ?? url,
    metadata: {
      stars: typeof parsed.stargazers_count === "number" ? parsed.stargazers_count : undefined,
      forks: typeof parsed.forks_count === "number" ? parsed.forks_count : undefined,
      license: (parsed.license as { spdx_id?: string } | null)?.spdx_id,
    },
  };
}

function extractJsonLd(html: string): Record<string, unknown> | null {
  const match = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim()) as Record<string, unknown> | Array<Record<string, unknown>>;
    return Array.isArray(parsed) ? parsed[0] ?? null : parsed;
  } catch {
    return null;
  }
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20_000);
}

function decodeEntities(input: string): string {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–", hellip: "…", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
  };
  return input
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[String(name).toLowerCase()] ?? match);
}

function firstMatch(input: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Handles both ISO-8601 durations (PT1H2M3S) and plain second counts. */
function parseDuration(value: string | undefined | null): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return null;
  const [, h, m, s] = match;
  return Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
}

function mapOgType(ogType: string | null): string | null {
  if (!ogType) return null;
  if (ogType.startsWith("video")) return "video";
  if (ogType === "article") return "blog";
  if (ogType === "book") return "book";
  return null;
}
