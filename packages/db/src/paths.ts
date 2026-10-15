import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * The monorepo root (the directory holding pnpm-workspace.yaml), found by walking up from cwd.
 * Resolving paths from the root keeps the CLI (cwd = packages/ingest) and Next (cwd = apps/web)
 * on the same PGlite directory and migrations folder; `import.meta.url` is unreliable once bundled.
 */
export function repoRoot(start: string = process.cwd()): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(start);
    dir = parent;
  }
}

export function migrationsFolder(): string {
  return join(repoRoot(), "packages", "db", "drizzle");
}

/** PGLITE_DIR overrides the data directory; "memory://" gives an in-memory database (tests). */
export function pgliteDataDir(): string {
  const override = process.env.PGLITE_DIR;
  if (override) return override;
  return join(repoRoot(), ".data", "pglite");
}
