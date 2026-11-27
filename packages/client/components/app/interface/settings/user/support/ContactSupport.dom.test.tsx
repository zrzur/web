import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";

const tickets = [
  {
    _id: "T1",
    subject: "My ticket",
    status: "Open",
    category: "account",
    updated_at: "2026-11-20T10:00:00Z",
  },
];
vi.mock("@revolt/client", () => ({
  useClient: () => () => ({ api: { get: () => Promise.resolve(tickets) } }),
}));
vi.mock("@revolt/i18n", () => ({ useError: () => () => "" }));
vi.mock("@revolt/ui", () => {
  const Pass = (props: { children?: unknown }) => (
    <div>{props.children as never}</div>
  );
  return {
    Button: Pass,
    CategoryButton: Object.assign(Pass, { Group: Pass }),
    Column: Pass,
    Dialog: Pass,
    FloatingSelect: Pass,
    MenuItem: Pass,
    SettingsFormPanel: Pass,
    SettingsSection: Pass,
    TextField: Pass,
    SettingsRow: (props: { title: unknown; onClick?: () => void }) => (
      <button type="button" onClick={() => props.onClick?.()}>
        {props.title as never}
      </button>
    ),
  };
});
const navigate = vi.fn();
vi.mock("../../Settings", () => ({ useSettingsNavigation: () => ({ navigate }) }));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));
vi.mock("../profile/CommunityParts", () => ({ useDate: () => () => "Nov 20" }));

import { ContactSupport } from "./ContactSupport";

let dispose: (() => void) | undefined;
afterEach(() => dispose?.());

describe("ContactSupport tickets", () => {
  it("opens a ticket as its own settings page", async () => {
    i18n.loadAndActivate({ locale: "en", messages: {} });
    document.body.replaceChildren(document.createElement("div"));
    dispose = render(
      () => (
        <I18nProvider i18n={i18n}>
          <ContactSupport />
        </I18nProvider>
      ),
      document.body.firstElementChild as HTMLElement,
    );
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain("My ticket"),
    );
    const row = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("My ticket"),
    )!;
    row.click();
    expect(navigate).toHaveBeenCalledWith("support/T1");
  });
});
