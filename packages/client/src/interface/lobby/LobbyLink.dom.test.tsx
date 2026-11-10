/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles */
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/routing", () => ({
  A: (props: any) => (
    <a href={props.href} data-testid={props["data-testid"]}>
      {props.children}
    </a>
  ),
  useLocation: () => ({ pathname: "/server/S1/channel/C1" }),
}));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));
vi.mock("@revolt/ui/icons/RulesIcon", () => ({ RulesIcon: () => <span /> }));

const { LobbyLink } = await import("./LobbyLink");

let dispose: (() => void) | undefined;

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.innerHTML = '<div id="root"></div>';
});
afterEach(() => dispose?.());

/** A server whose lobby switch and the viewer's Manage Server can change */
function mount(manager: boolean, enabled: boolean) {
  const [on, setOn] = createSignal(enabled);
  const server: any = {
    id: "S1",
    get lobby() {
      return on() ? { enabled: true } : { enabled: false };
    },
    havePermission: (p: string) => manager && p === "ManageServer",
  };
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <LobbyLink server={server} />
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );
  return setOn;
}

const row = () => document.querySelector('a[href="/server/S1/lobby"]');

describe("Lobby row in the channel list", () => {
  it("is hidden while the lobby is off, for managers too", () => {
    mount(true, false);
    expect(row()).toBeNull();
  });

  it("is hidden for members while the lobby is off", () => {
    mount(false, false);
    expect(row()).toBeNull();
  });

  it("shows for everyone once the lobby is on, at once", () => {
    const setOn = mount(false, false);
    expect(row()).toBeNull();
    setOn(true);
    expect(row()).not.toBeNull();
    expect(row()!.textContent).toContain("Lobby");
  });
});
