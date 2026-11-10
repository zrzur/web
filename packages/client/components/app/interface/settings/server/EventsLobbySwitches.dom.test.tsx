/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles */
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fake: any = { configuration: { features: { server_events: true } } };

vi.mock("@revolt/client", () => ({ useClient: () => () => fake }));
vi.mock("@revolt/i18n/errors", () => ({
  TranslatedError: (props: { error: unknown }) => (
    <span>{String(props.error)}</span>
  ),
}));
vi.mock("./savedNotice", () => ({ useSaved: () => () => undefined }));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));
vi.mock("@revolt/ui", () => ({
  Column: (props: any) => <div>{props.children}</div>,
  SettingsSection: (props: any) => <section>{props.children}</section>,
  Text: (props: any) => <p>{props.children}</p>,
  SettingsRow: (props: any) => (
    <div data-row={props.title}>
      <span id={`${props.title}-label`}>{props.title}</span>
      <span>{props.description}</span>
      {props.control({ labelId: `${props.title}-label` })}
    </div>
  ),
  Toggle: (props: any) => (
    <input
      type="checkbox"
      role="switch"
      aria-labelledby={props["aria-labelledby"]}
      checked={props.checked}
      disabled={props.disabled}
      onChange={() => props.onChange()}
    />
  ),
}));

const { EventsLobbySwitches } = await import("./EventsLobbySwitches");

let dispose: (() => void) | undefined;

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.innerHTML = '<div id="root"></div>';
  fake.configuration.features.server_events = true;
});
afterEach(() => dispose?.());

/** A server that applies edits like the SDK does after the PATCH */
function mount(manager = true) {
  const [events, setEvents] = createSignal(false);
  const [lobby, setLobby] = createSignal<any>(undefined);
  const edits: any[] = [];
  const server: any = {
    get eventsEnabled() {
      return events();
    },
    get lobby() {
      return lobby();
    },
    havePermission: () => manager,
    edit: vi.fn(async (data: any) => {
      edits.push(data);
      if ("events_enabled" in data) setEvents(data.events_enabled);
      if (data.lobby) setLobby(data.lobby);
    }),
    setEventsEnabled: vi.fn(async (on: boolean) => {
      edits.push({ events_enabled: on });
      setEvents(on);
    }),
  };
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <EventsLobbySwitches server={server} />
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );
  return { server, edits, setLobby };
}

const toggle = (name: string) =>
  document.querySelector<HTMLInputElement>(
    `[data-row="${name}"] input[role=switch]`,
  );
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("Events and lobby switches", () => {
  it("both start off in a new server", () => {
    mount();
    expect(toggle("Events")!.checked).toBe(false);
    expect(toggle("Lobby")!.checked).toBe(false);
  });

  it("turning events on saves at once", async () => {
    const { edits } = mount();
    toggle("Events")!.click();
    await flush();
    expect(edits).toEqual([{ events_enabled: true }]);
    expect(toggle("Events")!.checked).toBe(true);
  });

  it("turning the lobby on keeps the rest of the stored lobby", async () => {
    const { edits, setLobby } = mount();
    setLobby({ enabled: false, tagline: "Hello", actions: [] });
    toggle("Lobby")!.click();
    await flush();
    expect(edits).toEqual([
      { lobby: { enabled: true, tagline: "Hello", actions: [] } },
    ]);
    expect(toggle("Lobby")!.checked).toBe(true);
  });

  it("has no events switch while the platform has events off", () => {
    fake.configuration.features.server_events = false;
    mount();
    expect(toggle("Events")).toBeNull();
    expect(toggle("Lobby")).not.toBeNull();
  });

  it("members without Manage Server can't switch", () => {
    mount(false);
    expect(toggle("Events")!.disabled).toBe(true);
    expect(toggle("Lobby")!.disabled).toBe(true);
  });
});
