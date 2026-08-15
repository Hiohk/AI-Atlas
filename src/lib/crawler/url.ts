import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "metadata",
  "metadata.google.internal",
  "instance-data",
]);

/** Tracking parameters that create false-negative duplicate checks. */
const TRACKING_PARAMS = [
  /^utm_/i,
  /^ref$/i,
  /^referrer$/i,
  /^source$/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^mc_[a-z]+$/i,
  /^igshid$/i,
  /^si$/i,
  /^spm$/i,
];

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    if (normalized === "::1" || normalized === "::") return true;
    if (/^f[cd]/.test(normalized)) return true; // unique local
    if (/^fe[89ab]/.test(normalized)) return true; // link-local
    // IPv4-mapped addresses (::ffff:10.0.0.1) inherit the IPv4 rules.
    const mapped = normalized.match(/^::ffff:(.+)$/);
    if (mapped && isIP(mapped[1]) === 4) return isPrivateAddress(mapped[1]);
    return false;
  }
  return false;
}

/**
 * Validates a user-supplied URL and resolves it to a public IP.
 *
 * Submissions are attacker-controlled input aimed at our own network, so the
 * hostname is resolved here and the resulting address is checked — a DNS name
 * that points at 169.254.169.254 is rejected even though its text looks benign.
 * The resolved address is returned so the caller can pin the connection and
 * avoid a DNS-rebinding window between validation and fetch.
 */
export async function assertSafeUrl(rawUrl: string): Promise<{ url: URL; address: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new UnsafeUrlError("That does not look like a valid URL.");
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new UnsafeUrlError(`Only http and https URLs are supported (got ${url.protocol}).`);
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs with embedded credentials are not allowed.");
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".internal")) {
    throw new UnsafeUrlError("Internal hostnames are not allowed.");
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new UnsafeUrlError("Private network addresses are not allowed.");
    return { url, address: hostname };
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new UnsafeUrlError(`Could not resolve ${hostname}.`);
  }
  if (addresses.length === 0) throw new UnsafeUrlError(`Could not resolve ${hostname}.`);
  // Every resolved address must be public: a single private answer is enough
  // for an attacker to win the race.
  for (const { address } of addresses) {
    if (isPrivateAddress(address)) throw new UnsafeUrlError("That hostname resolves to a private network address.");
  }

  return { url, address: addresses[0].address };
}

/**
 * Canonicalises a URL for duplicate detection (level 1 of the dedupe stack):
 * lowercase host, strip `www.`, drop tracking params and fragments, normalise
 * trailing slashes, and unwrap well-known equivalent forms such as arXiv PDF
 * links and youtu.be shorteners.
 */
export function canonicalizeUrl(rawUrl: string): string {
  const url = new URL(rawUrl.trim());
  url.protocol = "https:";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.hash = "";
  url.port = "";

  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.some((rx) => rx.test(key))) url.searchParams.delete(key);
  }
  url.searchParams.sort();

  if (url.hostname === "arxiv.org") {
    const match = url.pathname.match(/\/(?:abs|pdf)\/([\w.\-\/]+?)(?:v\d+)?(?:\.pdf)?$/);
    if (match) url.pathname = `/abs/${match[1]}`;
  }
  if (url.hostname === "youtu.be") {
    const id = url.pathname.slice(1);
    url.hostname = "youtube.com";
    url.pathname = "/watch";
    url.search = `?v=${id}`;
  }
  if (url.hostname === "youtube.com") {
    const id = url.searchParams.get("v");
    if (id) url.search = `?v=${id}`;
  }
  if (url.hostname === "github.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) url.pathname = `/${parts[0]}/${parts[1]}`;
  }
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}

export function slugify(input: string, maxLength = 72): string {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return base || "resource";
}
