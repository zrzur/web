// After login the app may show "Review policy changes" over every page when a
// policy update was published on this stack, a few seconds after login. Tests
// acknowledge it as a person would, so it does not cover what they test.
export async function acknowledgePolicyNotice(page, { waitMs = 8000 } = {}) {
  const dialog = page
    .getByRole("dialog")
    .filter({
      hasText:
        /Review policy changes|مراجعة تغييرات السياسة|Richtlinienänderungen/,
    })
    .first();
  const shown = await dialog.waitFor({ state: "visible", timeout: waitMs }).then(
    () => true,
    () => false,
  );
  if (!shown) return false;
  for (const box of await dialog.getByRole("checkbox").all()) {
    if (!(await box.isChecked().catch(() => true))) {
      await box.check({ force: true }).catch(() => {});
    }
  }
  await dialog
    .getByRole("button", { name: /^(Acknowledge|إقرار|أقرّ|Bestätigen)$/ })
    .click({ timeout: 5000 })
    .catch(() =>
      dialog
        .getByRole("button", { name: /^(Close|إغلاق|Schließen)$/ })
        .click({ timeout: 3000 })
        .catch(() => {}),
    );
  await dialog.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  return true;
}
