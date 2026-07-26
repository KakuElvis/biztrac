import { test, expect } from "@playwright/test";

test.describe("BizTrac E2E POS Checkout", () => {
  test("loads demo shop and navigates to sales tab", async ({ page }) => {
    await page.goto("/");

    // Click demo button if auth screen is shown
    const demoButton = page.getByRole("button", { name: /use demo shop/i });
    if (await demoButton.isVisible()) {
      await demoButton.click();
    }

    // Verify main app dashboard loads
    await expect(page.getByText(/dashboard/i).first()).toBeVisible();

    // Navigate to Sales
    await page.getByRole("button", { name: /sales/i }).first().click();
    await expect(page.getByText(/cart/i).first()).toBeVisible();
  });
});
