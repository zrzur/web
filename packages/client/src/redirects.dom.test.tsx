import {
  MemoryRouter,
  Route,
  createMemoryHistory,
  useBeforeLeave,
} from "@solidjs/router";
import type { JSX } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A link inside the running app (`/invite/{code}`, `/bot/{id}`, `/settings`)
// must open its dialog when it is clicked, not only when the page is loaded
// at that address.

const openModal = vi.fn();
const showError = vi.fn();
const get = vi.fn(async (path: string) => ({ path }));
const fetchPublic = vi.fn(async (id: string) => ({ id }));
const openDM = vi.fn(async () => ({ id: "D1", path: "/channel/D1" }));
const fetchUser = vi.fn(async (id: string) => ({ id, openDM }));

vi.mock("@zrzur/sdk/solid", () => ({
  PublicChannelInvite: { from: (_: unknown, invite: unknown) => invite },
}));
vi.mock("@revolt/client", () => ({
  useClient: () => () => ({
    api: { get },
    bots: { fetchPublic },
    users: { fetch: fetchUser },
  }),
}));
vi.mock("@revolt/modal", () => ({
  useModals: () => ({ openModal, showError }),
}));
vi.mock("@revolt/state", () => ({
  useState: () => ({ layout: { getLastActivePath: () => "/chat" } }),
}));

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";

import {
  BotRedirect,
  InviteRedirect,
  SettingsRedirect,
  dialogAddress,
  openDialogAt,
} from "./redirects";

const BOT = "01M70R4TN68KPSV0TYV7GV6K6E";
let dispose: (() => void) | undefined;
let history: ReturnType<typeof createMemoryHistory>;

/** The part of the app's layout (Interface.tsx) that keeps a dialog's link on the page */
function Layout(props: { children?: JSX.Element }) {
  const client = useClient();
  const modals = useModals();
  useBeforeLeave((e) => {
    const dialog = typeof e.to === "string" ? dialogAddress(e.to) : undefined;
    if (dialog) {
      e.preventDefault();
      openDialogAt(dialog, client, modals);
    }
  });
  return <>{props.children}</>;
}

/**
 * The app at `start`, with links to the three addresses on the chat page;
 * `layout: false` leaves the layout's guard out, so the routes do the work
 */
function setup(start: string, layout = true) {
  history = createMemoryHistory();
  history.set({ value: start });
  document.body.innerHTML = '<div id="root"></div>';
  dispose = render(
    () => (
      <MemoryRouter
        history={history}
        root={
          layout
            ? Layout
            : (props: { children?: JSX.Element }) => <>{props.children}</>
        }
      >
        <Route
          path="/chat"
          component={() => (
            <div>
              <a id="invite" href="/invite/Dm8w7T5p">
                invite
              </a>
              <a id="bot" href={`/bot/${BOT}?permissions=8`}>
                bot
              </a>
              <a id="settings" href="/settings">
                settings
              </a>
            </div>
          )}
        />
        <Route path="/settings" component={SettingsRedirect} />
        <Route path="/invite/:code" component={InviteRedirect} />
        <Route path="/bot/:code" component={BotRedirect} />
      </MemoryRouter>
    ),
    document.getElementById("root")!,
  );
}

const settle = () => new Promise((done) => setTimeout(done, 20));

beforeEach(() => {
  openModal.mockClear();
  showError.mockClear();
  get.mockClear();
  fetchPublic.mockClear();
  fetchUser.mockClear();
  openDM.mockClear();
});
afterEach(() => dispose?.());

describe("dialogAddress", () => {
  it("reads the dialog out of an in-app address", () => {
    expect(dialogAddress("/settings")).toEqual({ kind: "settings" });
    expect(dialogAddress("/invite/Dm8w7T5p")).toEqual({
      kind: "invite",
      code: "Dm8w7T5p",
    });
    expect(dialogAddress(`/bot/${BOT}?permissions=8`)).toEqual({
      kind: "bot",
      code: BOT,
      search: "permissions=8",
    });
    expect(dialogAddress(`/b/${BOT}`)).toEqual({
      kind: "bot",
      code: BOT,
      search: "",
    });
  });

  it("reads a bot link with ?start as the conversation with the bot", () => {
    expect(dialogAddress(`/b/${BOT}?start=spring-sale`)).toEqual({
      kind: "bot-start",
      code: BOT,
      payload: "spring-sale",
    });
    expect(dialogAddress(`/bot/${BOT}?start`)).toEqual({
      kind: "bot-start",
      code: BOT,
      payload: undefined,
    });
    // a payload the server would refuse is dropped, the conversation opens
    expect(dialogAddress(`/b/${BOT}?start=no%20spaces`)).toEqual({
      kind: "bot-start",
      code: BOT,
      payload: undefined,
    });
  });

  it("leaves every other page alone, and a code that could change the request path", () => {
    for (const to of [
      "/",
      "/server/01M70R4TN68KPSV0TYV7GV6K6E",
      "/settings/account",
      "/invite",
      "/invite/a/b",
      "/invite/a%2Fb",
      "/invite/..%2Fusers",
      "/invite/%E0%A4%A",
      "/bot/a b",
    ])
      expect(dialogAddress(to), to).toBeUndefined();
  });
});

describe("addresses that open a dialog", () => {
  it("a clicked link opens the dialog through the routes too, without the layout's guard", async () => {
    setup("/chat", false);
    await settle();
    document.getElementById("invite")!.click();
    await settle();
    expect(get).toHaveBeenCalledTimes(1);
    expect(openModal).toHaveBeenCalledTimes(1);
    expect(history.get()).toBe("/chat");
  });

  it("opens the invite when the page is loaded at its address", async () => {
    setup("/invite/Dm8w7T5p");
    await settle();
    expect(get).toHaveBeenCalledWith("/invites/Dm8w7T5p");
    expect(openModal).toHaveBeenCalledWith(
      expect.objectContaining({ type: "invite" }),
    );
    expect(history.get()).toBe("/chat");
  });

  it("opens the invite when its link is clicked inside the running app", async () => {
    setup("/chat");
    await settle();
    document.getElementById("invite")!.click();
    await settle();
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("/invites/Dm8w7T5p");
    expect(openModal).toHaveBeenCalledTimes(1);
    expect(openModal).toHaveBeenCalledWith(
      expect.objectContaining({ type: "invite" }),
    );
    expect(history.get()).toBe("/chat");
  });

  it("opens the bot when its link is clicked inside the running app", async () => {
    setup("/chat");
    await settle();
    document.getElementById("bot")!.click();
    await settle();
    expect(fetchPublic).toHaveBeenCalledTimes(1);
    expect(fetchPublic).toHaveBeenCalledWith(BOT);
    expect(openModal).toHaveBeenCalledWith(
      expect.objectContaining({ type: "add_bot" }),
    );
  });

  it("opens settings when its link is clicked inside the running app", async () => {
    setup("/chat");
    await settle();
    document.getElementById("settings")!.click();
    await settle();
    expect(openModal).toHaveBeenCalledTimes(1);
    expect(openModal).toHaveBeenCalledWith({
      type: "settings",
      config: "user",
    });
  });

  it("opens the conversation with the bot for a link with ?start", async () => {
    const { botStartState } =
      await import("@revolt/app/interface/channels/text/interactions/botLinks");
    const go = vi.fn();
    openDialogAt(
      { kind: "bot-start", code: BOT, payload: "ref-7" },
      () => ({ users: { fetch: fetchUser } }) as never,
      { openModal, showError },
      go,
    );
    await settle();
    expect(fetchUser).toHaveBeenCalledWith(BOT);
    expect(openDM).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenCalledWith("/channel/D1");
    expect(botStartState.waiting.D1).toBe("ref-7");
    expect(openModal).not.toHaveBeenCalled();
  });

  it("asks for nothing when the code could change the request path", async () => {
    setup("/invite/a%2Fb");
    await settle();
    expect(get).not.toHaveBeenCalled();
    expect(openModal).not.toHaveBeenCalled();
  });
});
