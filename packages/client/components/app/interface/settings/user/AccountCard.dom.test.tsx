import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/ui", () => ({
  Avatar: () => <span data-avatar />,
  OverflowingText: (props: { children?: unknown }) => (
    <span>{props.children as never}</span>
  ),
  Ripple: () => null,
  UserStatus: { Graphic: () => <span data-presence /> },
}));
vi.mock("@revolt/ui/icons/legacy", () => ({ arrow_back: () => <span /> }));
vi.mock("@revolt/state", () => ({
  useState: () => ({ diagDrawer: () => undefined }),
}));
vi.mock("@revolt/client", () => ({
  useClient: () => () => ({
    user: { displayName: "Sam", animatedAvatarURL: "", presence: "Online" },
  }),
}));

const [page, setPage] = createSignal("account");
vi.mock("../Settings", () => ({
  useSettingsNavigation: () => ({ page, navigate: setPage }),
}));

import { SidebarButton } from "../_layout/SidebarButton";

import { AccountCard } from "./_AccountCard";

let dispose: (() => void) | undefined;

function mount() {
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <AccountCard />
        <SidebarButton
          aria-selected={page() === "sessions"}
          data-row="sessions"
        >
          Sessions
        </SidebarButton>
      </I18nProvider>
    ),
    document.body.firstElementChild as HTMLElement,
  );
}

const card = () =>
  [...document.querySelectorAll<HTMLElement>("[role='link']")].find((el) =>
    el.textContent?.includes("My account"),
  )!;
const ring = () => card().querySelector<HTMLElement>("[data-avatar-ring]")!;

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.replaceChildren(document.createElement("div"));
});
afterEach(() => dispose?.());

describe("account card in the settings sidebar", () => {
  it("selected: a ring around the avatar and no side bar", () => {
    setPage("account");
    mount();
    expect(card().getAttribute("aria-current")).toBe("page");
    expect(ring().dataset.selected).toBe("true");
    expect(card().hasAttribute("data-marker")).toBe(false);
    // the presence dot stays inside the ring
    expect(ring().querySelector("[data-avatar]")).not.toBeNull();
  });

  it("not selected: neither ring nor bar", () => {
    setPage("sessions");
    mount();
    expect(card().hasAttribute("aria-current")).toBe(false);
    expect(ring().dataset.selected).toBe("false");
    expect(card().hasAttribute("data-marker")).toBe(false);
  });

  it("other rows keep their bar when selected", () => {
    setPage("sessions");
    mount();
    const row = document.querySelector<HTMLElement>("[data-row='sessions']")!;
    expect(row.dataset.marker).toBe("bar");
    setPage("account");
    expect(row.hasAttribute("data-marker")).toBe(false);
  });
});
