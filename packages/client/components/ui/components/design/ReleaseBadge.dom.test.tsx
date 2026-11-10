import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ReleaseBadge } from "./ReleaseBadge";

let dispose: (() => void) | undefined;

function setup(channel: "beta" | "stable") {
  document.body.innerHTML = '<div id="root"></div>';
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <ReleaseBadge channel={channel} />
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );
  return document.querySelector<HTMLElement>("[data-release-badge]");
}

beforeEach(() => i18n.loadAndActivate({ locale: "en", messages: {} }));
afterEach(() => dispose?.());

describe("ReleaseBadge", () => {
  it("says Beta, with the explanation as tooltip and for screen readers", () => {
    const badge = setup("beta")!;
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe("Beta");
    expect(badge.title).toBe("Beta version: some things may still change.");
    expect(badge.getAttribute("aria-label")).toBe(
      "Beta version: some things may still change.",
    );
  });

  it("is not there on a stable release", () => {
    expect(setup("stable")).toBeNull();
  });
});
