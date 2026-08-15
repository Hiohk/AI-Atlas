# AI Atlas

The knowledge map for AI. A curated, searchable atlas of AI resources — papers, courses, repositories, tutorials, docs, tools — organised into topics and ordered learning paths, with an AI ingestion pipeline that turns a single submitted URL into a reviewed, scored, deduplicated catalogue entry.

Built with Next.js 15 (App Router, Server Components, Server Actions), TypeScript, Tailwind CSS v4, Drizzle ORM and Postgres with `pgvector`.

## Quick start

Requires Node 22.18 or newer. No database to install, no API keys.

```bash
npm install
npm run db:reset   # applies the schema, then seeds ~80 resources, 7 paths, 5 users
npm run dev
```

Open http://localhost:3000. Sign in with any seeded account (password `atlas1234`):

| Email | Role | What it unlocks |
| --- | --- | --- |
| `sierra@ai-atlas.dev` | Admin | Everything, including `/admin` |
| `mira@ai-atlas.dev` | Editor | Review queue, editor picks |
| `kai@ai-atlas.dev` | User | Library, bookmarks, submissions |

## How it runs with no setup

Two decisions remove the usual setup friction without weakening the production story:

**Embedded Postgres.** With `DATABASE_URL` unset, the app runs [PGlite](https://pglite.dev) — Postgres compiled to WASM — against `./.pglite`, with the `vector` extension loaded. The same Drizzle schema, the same SQL, the same `tsvector` and HNSW indexes as a hosted Postgres. Set `DATABASE_URL` and it connects to Supabase, Neon or RDS with no code change.

**Deterministic local embeddings.** The default AI provider is a rule-based analyser plus a hashed n-gram embedding function (384 dimensions, L2-normalised). Semantic search and duplicate detection work offline and produce identical vectors on every machine. Set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` to swap in a real model; see `.env.example`.

## Architecture

```
src/
  app/                    Routes. Server Components by default.
    actions/              Server Actions: auth, library, submissions
    api/                  Suggest endpoint, submission status polling
  components/             Design system + feature components
  lib/
    ai/                   Provider abstraction, Zod output schema, heuristics, embeddings
    analytics/            Event tracking and denormalised counters
    auth/                 scrypt password hashing, cookie sessions, RBAC
    crawler/              SSRF-safe URL validation and content extraction
    db/                   Drizzle schema, dual driver, migrations, seed corpus
    pipeline/             The ingestion state machine
    queries/              Read models, one module per surface
    ranking/              Trending score
    search/               Hybrid search and rank fusion
```

### The ingestion pipeline

A submission moves through an explicit state machine, with every transition written to `submission_events` so a failure is debuggable and retryable:

```
submitted → fetching → analyzing → duplicate_check → ready_for_review → published
                                                   ↘ rejected / failed
```

1. **Validate.** The URL is parsed, normalised and resolved. Private and link-local address ranges, embedded credentials and non-HTTP schemes are rejected before any request leaves the process.
2. **Fetch.** Redirects are capped, the body is read through a hard size limit, and the content type must be on an allowlist. Each redirect hop is re-validated, so a public hostname cannot redirect into the private network.
3. **Analyse.** The provider returns a single structured record validated against a Zod schema: type, topics, summary, difficulty, prerequisites, quality breakdown, spam verdict, confidence. Model prose is never persisted unvalidated.
4. **Deduplicate.** Three layers: exact canonical URL, content hash, then cosine similarity over embeddings. Above the similarity threshold the submission is linked to the existing resource and flagged for a human.
5. **Review.** An editor sees the draft, the pipeline trace, the duplicate evidence and the model's confidence, then approves, picks or rejects with a reason.

The work runs in `after()` so the contributor's request returns as soon as the row exists; the submit form then polls the status endpoint and renders each stage as it completes. In production this is where a queue (Trigger.dev, QStash, a worker) would slot in without changing the state machine.

### Hybrid search

Keyword and semantic retrieval run in parallel, then fuse:

- **Keyword** — Postgres full-text search over a generated `tsvector` column, ranked with `ts_rank_cd`, with `ts_headline` for the snippet.
- **Semantic** — `pgvector` cosine distance over resource embeddings, HNSW indexed.
- **Fusion** — reciprocal rank fusion, which combines the two orderings without requiring `ts_rank` and cosine distance to share a scale. The fused shortlist is then re-ordered by quality, popularity, freshness and editorial signals.

`/search` exposes all three modes and prints each result's keyword, semantic and fused score, because a ranking you cannot inspect is a ranking you cannot tune.

### Trending

Topics and resources are ranked by acceleration, not volume: each window is compared against the window immediately before it, multiplied by quality and editorial weight, and decayed with age. Search queries that return few results are surfaced as content gaps on `/trending` and in the admin console — the backlog, taken straight from demand.

### Auth and permissions

Sessions are opaque tokens in an `httpOnly`, `sameSite=lax` cookie, hashed at rest, with passwords hashed using `scrypt` from the standard library. Five roles escalate monotonically: visitor, user, contributor, editor, admin. Server Actions check the role themselves rather than trusting the UI, and the schema carries Row-Level Security policies for when the database is exposed directly.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run db:generate` | Generate SQL migrations from the Drizzle schema |
| `npm run db:push` | Apply migrations (creates the `vector` extension first) |
| `npm run db:seed` | Seed the corpus, embeddings, activity and trending scores |
| `npm run db:reset` | Delete `.pglite`, migrate and re-seed |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## Deployment

1. Provision Postgres 15+ with `pgvector` (Supabase, Neon and RDS all work) and set `DATABASE_URL`.
2. Run `npm run db:push` then `npm run db:seed`.
3. Set `NEXT_PUBLIC_SITE_URL`, and an AI provider key if you want real model analysis.
4. Deploy to any Node host. The only stateful dependency is Postgres.

Two things to change before real traffic: the rate limiter is process-local and should move to Redis or Postgres behind more than one instance, and the pipeline's `after()` execution should become a durable queue.

## Notes on scope

This is a portfolio implementation of a product spec, so a few deliberate trade-offs are worth naming. Seeded engagement numbers are synthetic, generated with plausible distributions to make the ranking and trending surfaces legible. Taxonomy editing in the admin console is read-only. Email verification, OAuth and password reset are stubbed out at the session layer rather than built.
