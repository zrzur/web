import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { createMutable } from "solid-js/store";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/ui", async () => ({
  ...(await import("@revolt/ui/components/design/Settings")),
  Toggle: (await import("@revolt/ui/components/design/Toggle")).Toggle,
  Avatar: () => <span />,
  Button: (props: { children?: unknown }) => (
    <button type="button">{props.children as never}</button>
  ),
  UserStatus: { Graphic: () => <span /> },
}));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));
vi.mock("@revolt/i18n", () => ({
  useTime: () => () => ({ format: () => "1 January 2026" }),
}));

const values = createMutable<Record<string, unknown>>({});
const state = createMutable({
  settings: {
    getValue: (key: string) => values[key],
    setValue: (key: string, value: unknown) => void (values[key] = value),
    get streamerMode() {
      return !!values["privacy:streamer_mode"];
    },
    set streamerMode(on: boolean) {
      values["privacy:streamer_mode"] = on;
    },
  },
  keybinds: {
    table: () => ({
      byId: { toggle_streamer: { code: "KeyL", mod: true, shift: true } },
    }),
  },
});
vi.mock("@revolt/state", () => ({ useState: () => state }));

import StreamerIndicator from "../../StreamerIndicator";

import { UserSummary } from "./account/UserSummary";
import { StreamerModeSection } from "./StreamerMode";

let dispose: (() => void) | undefined;

function mount(view: () => unknown) {
  dispose = render(
    () => <I18nProvider i18n={i18n}>{view() as never}</I18nProvider>,
    document.body.firstElementChild as HTMLElement,
  );
}

const switchNamed = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('[role="switch"]')].find(
    (el) =>
      document.getElementById(el.getAttribute("aria-labelledby")!)
        ?.textContent === name,
  )!;

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.replaceChildren(document.createElement("div"));
  state.settings.streamerMode = false;
  values["privacy:streamer_on_share"] = false;
});
afterEach(() => dispose?.());

describe("streamer mode switch", () => {
  it("is off by default and turns on with its switch", () => {
    mount(() => <StreamerModeSection />);
    const toggle = switchNamed("Streamer mode");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    toggle.click();
    expect(state.settings.streamerMode).toBe(true);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  it("shows its shortcut", () => {
    mount(() => <StreamerModeSection />);
    expect(document.body.textContent).toContain("Ctrl+Shift+L");
  });

  it("keeps 'on while sharing' off until the person turns it on", () => {
    mount(() => <StreamerModeSection />);
    const toggle = switchNamed("Turn on while sharing your screen");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    toggle.click();
    expect(values["privacy:streamer_on_share"]).toBe(true);
  });
});

describe("what streamer mode hides", () => {
  const user = {
    username: "sam",
    discriminator: "4242",
    displayName: "Sam",
    createdAt: new Date(),
  } as never;

  it("hides the own tag in the account header, live", () => {
    mount(() => <UserSummary user={user} />);
    const tag = document.querySelector('[data-testid="own-tag"]')!;
    expect(tag.textContent).toBe("#4242");
    state.settings.streamerMode = true;
    expect(tag.textContent).toBe("#••••");
    expect(document.body.textContent).not.toContain("4242");
  });

  it("the sign at the top turns the mode off", () => {
    state.settings.streamerMode = true;
    mount(() => <StreamerIndicator />);
    const sign = document.querySelector<HTMLButtonElement>(
      '[data-testid="streamer-indicator"]',
    )!;
    expect(sign.textContent).toContain("Streamer mode");
    sign.click();
    expect(state.settings.streamerMode).toBe(false);
  });
});
