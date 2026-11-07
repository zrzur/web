import { expect, test } from "@playwright/test";

test("shows a working login page", async ({ page }) => {
  await page.goto("");
  await expect(page).toHaveTitle(/Zrzur/);

  const form = page.locator("form");
  await expect(form.locator('input[name="email"]')).toBeVisible();
  await expect(form.locator('input[name="password"]')).toBeVisible();
  await expect(form.locator('button[type="submit"]')).toBeVisible();

  await page.locator('a[href$="/login/create"]').first().click();

  await expect(page).toHaveURL(/\/login\/create$/);
  await expect(page.locator('input[name="new-password"]')).toBeVisible();
});
