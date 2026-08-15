import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the trace root to this project; a lockfile further up the tree would
  // otherwise be inferred as the workspace root.
  outputFileTracingRoot: path.resolve(import.meta.dirname),
  // PGlite ships a WASM build of Postgres and the pgvector extension ships as a
  // tarball. Both must stay external, or webpack rewrites them to asset URLs
  // that the runtime cannot load.
  serverExternalPackages: ["@electric-sql/pglite", "@electric-sql/pglite-pgvector"],
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
