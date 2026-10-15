import { existsSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.E2E_BASE_URL;

/**
 * Build containers pre-install one Chromium under PLAYWRIGHT_BROWSERS_PATH (with a `chromium` symlink) whose
 * revision can lag this Playwright release, and `playwright install` is not allowed there. Use that binary when
 * present; PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH overrides it, and with neither Playwright uses its own download.
 */
function chromiumExecutablePath(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!browsersPath) return undefined;
  const preinstalled = join(browsersPath, "chromium");
  return existsSync(preinstalled) ? preinstalled : undefined;
}

const executablePath = chromiumExecutablePath();

export default defineConfig({
  testDir: "e2e",
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: externalBaseURL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], ...(executablePath ? { launchOptions: { executablePath } } : {}) },
    },
  ],
  ...(externalBaseURL
    ? {}
    : {
        webServer: {
          command: "pnpm dev",
          url: "http://localhost:3000",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
