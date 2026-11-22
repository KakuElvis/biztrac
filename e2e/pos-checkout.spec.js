import { test, expect } from "@playwright/test";

test.describe("BizPurse E2E App Flow", () => {
  test("renders authentication screen for unauthenticated users", async ({ page }) => {
    await page.goto("/");

    // Verify authentication screen is shown with registration/login
    await expect(page.getByRole("button", { name: /create workspace/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /login/i })).toBeVisible();
  });
});
