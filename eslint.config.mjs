import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const PACKAGES = ["shared", "db", "era", "ingest", "knowledge", "billing", "stripe", "core", "agents"];

/** Matches a module specifier and its subpaths, e.g. `stripe` and `stripe/lib/x`. */
const moduleRegex = (name) => `^${name.replace(/[/.]/g, "\\$&")}(/.*)?$`;

/**
 * Builds the `no-restricted-imports` patterns for one workspace (`@ghost/<name>` or `@ghost/web`).
 * Flat config replaces a rule per matching block rather than merging it, so each workspace gets its full list.
 */
function restrictedImportsFor(name) {
  const patterns = [{ regex: moduleRegex("@ghost/web"), message: "Nothing may import apps/web (INSTRUCTIONS §4)." }];
  if (name === "shared") {
    patterns.push({
      regex: "^@ghost/(?!shared(/|$))",
      message: "@ghost/shared imports no other workspace package (INSTRUCTIONS §4).",
    });
  }
  if (name === "billing") {
    patterns.push({
      regex: "^@ghost/(?!shared(/|$))",
      message: "@ghost/billing may import only @ghost/shared (INSTRUCTIONS §4).",
    });
  }
  if (name !== "era") {
    patterns.push({
      regex: moduleRegex("@modelcontextprotocol/sdk"),
      message: "Only @ghost/era may import the MCP SDK (INSTRUCTIONS §3).",
    });
  }
  if (name !== "stripe") {
    patterns.push({ regex: moduleRegex("stripe"), message: "Only @ghost/stripe may import the Stripe SDK." });
  }
  if (name !== "agents") {
    patterns.push({
      regex: "^(@mastra/|@ai-sdk/|ai(/.*)?$)",
      message: "Only @ghost/agents may import Mastra or the AI SDK (INSTRUCTIONS §7).",
    });
  }
  return ["error", { patterns }];
}

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/coverage/**",
      "playwright-report/**",
      "test-results/**",
      "fixtures/**",
      "docs/**",
      "apps/web/next-env.d.ts",
    ],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Root-level TS files are not part of any package tsconfig.
          allowDefaultProject: ["*.ts", "e2e/*.ts"],
          defaultProject: "tsconfig.base.json",
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ["scripts/**", "e2e/**"],
    rules: { "no-console": "off" },
  },
  ...PACKAGES.map((name) => ({
    files: [`packages/${name}/**/*.{ts,tsx}`],
    rules: { "no-restricted-imports": restrictedImportsFor(name) },
  })),
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    ...reactHooks.configs.flat.recommended,
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin },
    settings: { next: { rootDir: "apps/web/" } },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "no-restricted-imports": restrictedImportsFor("web"),
    },
  },
);
