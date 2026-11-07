import { Page, expect, test } from "@playwright/test";

/**
 * Billing UI pass against a LOCAL backend in internal test mode (simulated
 * payments, never a real provider). Needs a throwaway test account:
 *
 *   ZRZUR_E2E_EMAIL / ZRZUR_E2E_PASSWORD  test account credentials
 *   ZRZUR_SHOT_DIR                          where screenshots go
 *
 * Buys Plus with the simulated provider, opens the payment status window
 * the way returning from a provider's page does, checks the history, and
 * shows the locked state (live payments not open yet) by answering
 * `/billing/plans` like a live-ready server would.
 */
const email = process.env.ZRZUR_E2E_EMAIL;
const password = process.env.ZRZUR_E2E_PASSWORD;
const dir = process.env.ZRZUR_SHOT_DIR ?? "test-results/billing";

test.skip(
  !email || !password,
  "set ZRZUR_E2E_EMAIL and ZRZUR_E2E_PASSWORD",
);
test.use({ colorScheme: "dark" });
test.describe.configure({ timeout: 120_000 });

async function login(page: Page) {
  await page.goto("/login/auth");
  const form = page.locator("form");
  await form.locator('input[name="email"]').fill(email!);
  await form.locator('input[name="password"]').fill(password!);
  await form.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function openSettingsPage(page: Page, label: RegExp) {
  await page
    .getByRole("button", { name: /User settings|إعدادات المستخدم/ })
    .click();
  await page.getByRole("link", { name: label }).first().click();
  await page.waitForTimeout(500);
}

test("buy Feather with simulated payments, then see status and history", async ({
  page,
}) => {
  await login(page);
  await openSettingsPage(page, /Zrzur Feather$/);
  await expect(page.getByText(/Test mode/).first()).toBeVisible();
  await page.screenshot({ path: `${dir}/1-plus-page.png` });

  await page
    .getByRole("button", { name: /Get Feather for/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog").last();
  await expect(dialog.getByText("Zrzur Feather, monthly")).toBeVisible();
  await page.screenshot({ path: `${dir}/2-plus-checkout.png` });

  const created = page.waitForResponse(
    (r) =>
      r.url().endsWith("/billing/orders") && r.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Start Feather" }).click();
  const order = (await (await created).json()).order;
  // simulated provider: the server confirmed it
  await page.waitForResponse((r) =>
    r.url().includes(`/orders/${order._id}/pay`),
  );

  // what returning from a provider's payment page looks like
  await page.goto(`/?billing_order=${order._id}&billing_return=success`);
  const status = page.getByRole("dialog").last();
  await expect(status.getByText("Payment complete")).toBeVisible({
    timeout: 20_000,
  });
  // the address no longer carries the order
  expect(page.url()).not.toContain("billing_order");
  await page.screenshot({ path: `${dir}/3-status-paid.png` });
  await page.keyboard.press("Escape");

  await openSettingsPage(page, /^Subscriptions$/);
  await expect(page.getByText("Payment received").first()).toBeVisible();
  await page.screenshot({ path: `${dir}/4-subscriptions.png`, fullPage: true });
});

test("locked checkout shows a clear state instead of a pay button", async ({
  page,
}) => {
  await page.route("**/billing/plans", async (route) => {
    const response = await route.fetch();
    const plans = await response.json();
    await route.fulfill({
      response,
      json: {
        ...plans,
        checkout_available: false,
        mode: "live_ready",
        provider: "stripe",
        test_mode: false,
      },
    });
  });
  // as someone without Plus (the account may have bought it above)
  await page.route("**/billing/@me", (route) =>
    route.fulfill({ json: { hide_badge: false, supercharges: [] } }),
  );
  await login(page);
  await openSettingsPage(page, /Zrzur Feather$/);
  await expect(
    page.getByText(/Purchases aren't open yet/).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Get Feather for/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog").last();
  const button = dialog.getByRole("button", { name: "Not open yet" });
  await expect(button).toBeVisible();
  await expect(button).toBeDisabled();
  await page.screenshot({ path: `${dir}/5-locked.png` });
});

test.describe("Arabic", () => {
  test.use({ locale: "ar" });

  test("status window and notices read right to left", async ({ page }) => {
    await login(page);
    await openSettingsPage(page, /(Subscriptions|الاشتراكات)$/);
    await page.screenshot({
      path: `${dir}/6-subscriptions-ar.png`,
      fullPage: true,
    });
  });
});
