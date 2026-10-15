import { expect, test } from "@playwright/test";

test("home page renders the Ghost wordmark text", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("main")).toHaveText("Ghost");
});
