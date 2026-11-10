/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles */
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
const fake: any = {
  configuration: { features: { server_events: true } },
  serverEvents: {
    isLoaded: () => true,
    fetchForServer: vi.fn(async () => undefined),
    forServer: () => [],
  },
};

vi.mock("@revolt/client", () => ({ useClient: () => () => fake }));
vi.mock("@revolt/keybinds/active", () => ({ deviceMac: () => false }));
vi.mock("@revolt/keybinds/keyLabels", () => ({ ariaKeys: () => undefined }));
vi.mock("@revolt/keybinds/shortcuts", () => ({
  isMac: () => false,
  isTypingTarget: () => false,
}));
vi.mock("@revolt/modal", () => ({
  useModals: () => ({ isOpen: () => false }),
}));
vi.mock("@revolt/routing", () => ({
  A: (props: any) => (
    <a href={props.href} data-testid={props["data-testid"]}>
      {props.children}
    </a>
  ),
  useLocation: () => ({ pathname: "/server/S1/channel/C1" }),
  useNavigate: () => navigate,
}));
vi.mock("@revolt/state", () => ({
  useState: () => ({
    appDrawer: () => undefined,
    keybinds: { table: () => ({ byId: {} }) },
  }),
}));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));
vi.mock("./EventCard", () => ({ JoinButton: () => <span /> }));
vi.mock("./eventFormat", () => ({
  isEventsShortcut: (e: KeyboardEvent) =>
    e.ctrlKey && e.shiftKey && e.code === "Digit9",
  eventsShortcutAllowed: () => true,
}));

const { EventsLink } = await import("./EventsLink");

let dispose: (() => void) | undefined;

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.innerHTML = '<div id="root"></div>';
  fake.configuration.features.server_events = true;
  navigate.mockClear();
});
afterEach(() => dispose?.());

function mount(enabled: boolean) {
  const [on, setOn] = createSignal(enabled);
  const server: any = {
    id: "S1",
    get eventsEnabled() {
      return on();
    },
    havePermission: () => true,
  };
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <EventsLink server={server} />
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );
  return setOn;
}

const row = () => document.querySelector('[data-testid="events-link"]');
const shortcut = () =>
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      code: "Digit9",
      ctrlKey: true,
      shiftKey: true,
      cancelable: true,
    }),
  );

describe("Events row in the channel list", () => {
  it("is hidden while the server has events off", () => {
    mount(false);
    expect(row()).toBeNull();
  });

  it("shows once the server turns events on, at once", () => {
    const setOn = mount(false);
    setOn(true);
    expect(row()).not.toBeNull();
  });

  it("stays hidden while the platform has events off", () => {
    fake.configuration.features.server_events = false;
    mount(true);
    expect(row()).toBeNull();
  });

  it("the shortcut does nothing while the server has events off", () => {
    const setOn = mount(false);
    shortcut();
    expect(navigate).not.toHaveBeenCalled();
    setOn(true);
    shortcut();
    expect(navigate).toHaveBeenCalledWith("/server/S1/events");
  });
});
