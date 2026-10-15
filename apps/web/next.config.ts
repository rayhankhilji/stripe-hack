import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  typedRoutes: true,
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
