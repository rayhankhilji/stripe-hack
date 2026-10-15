import type { NextConfig } from "next";
import { join } from "node:path";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  typedRoutes: false,
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingRoot: join(__dirname, "../.."),
  outputFileTracingIncludes: { "/**": ["../../packages/db/drizzle/**", "../../fixtures/era/**", "../../pnpm-workspace.yaml"] },
  // Agent instructions live in the repo-root INSTRUCTIONS.md; stop `next dev` writing apps/web/AGENTS.md.
  agentRules: false,
  transpilePackages: [
    "@ghost/agents",
    "@ghost/billing",
    "@ghost/core",
    "@ghost/db",
    "@ghost/era",
    "@ghost/ingest",
    "@ghost/knowledge",
    "@ghost/shared",
    "@ghost/stripe",
  ],
  serverExternalPackages: ["@electric-sql/pglite", "@mastra/core", "@mastra/pg"],
};

export default nextConfig;
