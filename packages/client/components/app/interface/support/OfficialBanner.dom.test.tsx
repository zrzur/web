import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// the ticket form, loaded on demand: it can fail (offline) and come later
const form = vi.hoisted(() => ({ fail: true }));
vi.mock("../settings/user/support/ContactSupport", () => ({
  get NewTicket() {
    if (form.fail)
      throw new Error("Failed to fetch dynamically imported module");
    return (props: { subject?: string }) => (
      <div data-testid="ticket-form">{props.subject}</div>
    );
  },
}));
vi.mock("@revolt/state", () => ({ useState: () => undefined }));
vi.mock("@revolt/client", () => ({
  useClient: () => () => ({
    messages: { get: () => ({ content: "**Your badge** is here" }) },
  }),
}));
vi.mock("@revolt/ui", () => ({
  Button: (props: { children?: unknown; onPress?: () => void }) => (
    <button onClick={() => props.onPress?.()}>{props.children as never}</button>
  ),
}));

import { OfficialBanner } from "./OfficialBanner";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
let dispose: (() => void) | undefined;
beforeEach(() => {
  form.fail = true;
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.innerHTML = '<div id="root"></div>';
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <OfficialBanner channel={{ lastMessageId: "M1" } as never} />
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );
});
afterEach(() => dispose?.());

const button = (name: string) =>
  [...document.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(name),
  )!;

it("says in plain words when the form can't load, and tries again", async () => {
  // the early fetch on mount failed quietly (no unhandled rejection)
  await settle();
  button("Reply in a ticket").click();
  expect(document.querySelector('[role="status"]')?.textContent).toContain(
    "Loading",
  );
  await settle();
  await settle();
  const alert = document.querySelector('[role="alert"]');
  expect(alert?.textContent).toContain("The ticket form couldn't be loaded.");
  expect(document.querySelector('[data-testid="ticket-form"]')).toBeNull();

  form.fail = false;
  button("Try again").click();
  await settle();
  await settle();
  expect(document.querySelector('[role="alert"]')).toBeNull();
  expect(
    document.querySelector('[data-testid="ticket-form"]')?.textContent,
  ).toBe("Re: Your badge is here");
});

it("opens the form when it loads", async () => {
  form.fail = false;
  button("Reply in a ticket").click();
  await settle();
  await settle();
  expect(document.querySelector('[data-testid="ticket-form"]')).not.toBeNull();
});
