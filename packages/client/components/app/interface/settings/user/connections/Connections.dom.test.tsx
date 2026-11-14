import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/ui", async () => {
  const settings = await import("@revolt/ui/components/design/Settings");
  return {
    SettingsSection: settings.SettingsSection,
    SettingsRow: settings.SettingsRow,
    Button: (props: {
      children?: unknown;
      onPress?: () => void;
      isDisabled?: boolean;
    }) => (
      <button
        type="button"
        disabled={props.isDisabled}
        onClick={() => props.onPress?.()}
      >
        {props.children as never}
      </button>
    ),
    Checkbox: (props: {
      children?: unknown;
      checked?: boolean;
      disabled?: boolean;
      onChange?: (event: { currentTarget: { checked: boolean } }) => void;
    }) => (
      <label>
        <input
          type="checkbox"
          checked={props.checked}
          disabled={props.disabled}
          onChange={(event) =>
            props.onChange?.({
              currentTarget: { checked: event.currentTarget.checked },
            })
          }
        />
        {props.children as never}
      </label>
    ),
    Toggle: (props: {
      checked: boolean;
      onChange?: (checked: boolean) => void;
    }) => (
      <button
        type="button"
        role="switch"
        aria-checked={props.checked}
        onClick={() => props.onChange?.(!props.checked)}
      />
    ),
    CircularProgress: () => <span data-loading />,
    Column: (props: { children?: unknown }) => (
      <div>{props.children as never}</div>
    ),
  };
});
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));
vi.mock("@revolt/ui/components/features/profiles/SteamTile", () => ({
  SteamTile: () => <span data-tile />,
}));
const openModal = vi.fn();
vi.mock("@revolt/modal", () => ({ useModals: () => ({ openModal }) }));
vi.mock("@revolt/i18n/errors", () => ({
  TranslatedError: (props: { error: unknown }) => (
    <span data-error>{String((props.error as Error)?.message)}</span>
  ),
}));
vi.mock("@revolt/client", () => ({
  useClient: () => () => ({ user: { id: "me" } }),
}));
const invalidate = vi.fn();
vi.mock("@tanstack/solid-query", () => ({
  useQueryClient: () => ({ invalidateQueries: invalidate }),
}));

const api = vi.hoisted(() => ({
  list: vi.fn(),
  start: vi.fn(),
  edit: vi.fn(),
  refresh: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock("./connectionsApi", () => ({
  connectionsApi: api,
  STEAM_CONSENT_VERSION: 2,
}));

import { Connections } from "./Connections";

let dispose: (() => void) | undefined;

function mount() {
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <Connections />
      </I18nProvider>
    ),
    document.body.firstElementChild as HTMLElement,
  );
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const text = () => document.body.textContent ?? "";
const button = (name: string) =>
  [...document.querySelectorAll("button")].find(
    (el) => el.textContent?.trim() === name,
  ) as HTMLButtonElement | undefined;

const linked = (change: Record<string, unknown> = {}) => ({
  service: "steam",
  display_name: "Gamer",
  profile_url: "https://steamcommunity.com/id/gamer/",
  shown: false,
  private: false,
  game_count: 42,
  total_hours: 1234,
  games: [
    {
      appid: 570,
      name: "Dota 2",
      hours: 100,
      achievements_unlocked: 12,
      achievements_total: 30,
      header_url: "https://cdn.cloudflare.steamstatic.com/steam/apps/570/header.jpg",
      store_url: "https://store.steampowered.com/app/570/",
    },
    {
      appid: 620,
      name: "Portal 2",
      hours: 10,
      store_url: "https://store.steampowered.com/app/620/",
    },
  ],
  achievements: [
    {
      appid: 570,
      game: "Dota 2",
      name: "First blood",
      description: "Win a match",
      unlocked_on: "2026-11-12",
    },
    {
      appid: 620,
      game: "Portal 2",
      name: "Wake up call",
      description: "",
      unlocked_on: "2026-11-09",
    },
  ],
  hidden_titles: [],
  consent_current: true,
  linked_at: 1,
  refreshed_at: 1,
  refresh_after: 0,
  ...change,
});

const assign = vi.fn();

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.replaceChildren(document.createElement("div"));
  Object.values(api).forEach((fn) => fn.mockReset());
  invalidate.mockReset();
  openModal.mockReset();
  assign.mockReset();
  vi.stubGlobal("location", {
    ...window.location,
    origin: "https://app.zrzur.com",
    assign,
  });
});
afterEach(() => {
  dispose?.();
  vi.unstubAllGlobals();
});

describe("Connections", () => {
  it("asks for consent before leaving for Steam", async () => {
    api.list.mockResolvedValue({ steam: { available: true } });
    api.start.mockResolvedValue({ url: "https://steamcommunity.com/openid/login?x" });
    mount();
    await flush();

    expect(text()).toContain("We never see your Steam password.");
    button("Connect Steam")!.click();
    await flush();

    const go = button("Continue to Steam")!;
    expect(go.disabled).toBe(true);
    expect(text()).toContain("What you play can say something");
    expect(api.start).not.toHaveBeenCalled();

    const box = document.querySelector<HTMLInputElement>(
      "input[type=checkbox]",
    )!;
    expect(box.checked).toBe(false);
    box.click();
    await flush();
    expect(go.disabled).toBe(false);

    go.click();
    await flush();
    expect(api.start).toHaveBeenCalledWith(
      expect.anything(),
      "https://app.zrzur.com",
    );
    expect(assign).toHaveBeenCalledWith(
      "https://steamcommunity.com/openid/login?x",
    );
  });

  it("Not now closes the consent without contacting Steam", async () => {
    api.list.mockResolvedValue({ steam: { available: true } });
    mount();
    await flush();
    button("Connect Steam")!.click();
    await flush();
    button("Not now")!.click();
    await flush();
    expect(button("Continue to Steam")).toBeUndefined();
    expect(api.start).not.toHaveBeenCalled();
  });

  it("says so when the server has no Steam key", async () => {
    api.list.mockResolvedValue({ steam: { available: false } });
    mount();
    await flush();
    expect(text()).toContain("Steam can't be linked on this server yet.");
    expect(button("Connect Steam")).toBeUndefined();
  });

  it("previews a new link and shows it on request", async () => {
    api.list.mockResolvedValue({ steam: { available: true, account: linked() } });
    api.edit.mockImplementation(async (_c, change) => linked(change));
    mount();
    await flush();

    expect(text()).toContain("Gamer");
    expect(text()).toContain("This is a preview.");
    expect(text()).toContain("Not on your profile");
    expect(text()).toContain("12 of 30 achievements");

    document.querySelector<HTMLButtonElement>("[role=switch]")!.click();
    await flush();
    expect(api.edit).toHaveBeenCalledWith(expect.anything(), { shown: true });
    expect(text()).toContain("On your profile");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["profile", "me"] });
  });

  it("hides one game", async () => {
    api.list.mockResolvedValue({ steam: { available: true, account: linked() } });
    api.edit.mockImplementation(async (_c, change) => linked(change));
    mount();
    await flush();

    const boxes = document.querySelectorAll<HTMLInputElement>(
      "input[type=checkbox]",
    );
    expect(boxes).toHaveLength(2);
    boxes[1].click();
    await flush();
    expect(api.edit).toHaveBeenCalledWith(expect.anything(), {
      hidden_titles: [620],
    });
  });

  it("disconnects in one press", async () => {
    api.list.mockResolvedValue({ steam: { available: true, account: linked() } });
    api.disconnect.mockResolvedValue(undefined);
    mount();
    await flush();
    button("Disconnect")!.click();
    await flush();
    expect(api.disconnect).toHaveBeenCalledTimes(1);
    expect(button("Connect Steam")).toBeDefined();
  });

  it("waits before Refresh works again", async () => {
    api.list.mockResolvedValue({
      steam: {
        available: true,
        account: linked({ refresh_after: Date.now() + 600_000 }),
      },
    });
    mount();
    await flush();
    expect(button("Refresh")!.disabled).toBe(true);
  });

  it("a private account says how to fix it", async () => {
    api.list.mockResolvedValue({
      steam: {
        available: true,
        account: linked({ private: true, games: [], game_count: undefined }),
      },
    });
    mount();
    await flush();
    expect(text()).toContain("Make them public on Steam, then press Refresh.");
  });

  it("asks people linked under the old text before showing anything new", async () => {
    api.list.mockResolvedValue({
      steam: { available: true, account: linked({ consent_current: false }) },
    });
    api.edit.mockImplementation(async (_c, change) =>
      linked({ consent_current: change.consent === 2 }),
    );
    mount();
    await flush();

    expect(text()).toContain("New on your Steam card");
    const save = button("Save")!;
    expect(save.disabled).toBe(true);
    [...document.querySelectorAll<HTMLInputElement>("input[type=checkbox]")]
      .find((box) => box.closest("label")?.textContent?.includes("Show these"))!
      .click();
    await flush();
    expect(save.disabled).toBe(false);
    save.click();
    await flush();
    expect(api.edit).toHaveBeenCalledWith(expect.anything(), { consent: 2 });
    expect(text()).not.toContain("New on your Steam card");
  });

  it("Keep it as it is changes nothing", async () => {
    api.list.mockResolvedValue({
      steam: { available: true, account: linked({ consent_current: false }) },
    });
    mount();
    await flush();
    button("Keep it as it is")!.click();
    await flush();
    expect(text()).not.toContain("New on your Steam card");
    expect(api.edit).not.toHaveBeenCalled();
  });

  it("the preview leaves hidden games and their achievements out", async () => {
    api.list.mockResolvedValue({
      steam: { available: true, account: linked({ hidden_titles: [620] }) },
    });
    mount();
    await flush();
    button("Open preview")!.click();
    const shown = openModal.mock.calls[0][0];
    expect(shown.type).toBe("steam_games");
    expect(shown.games.games.map((g: { appid: number }) => g.appid)).toEqual([570]);
    expect(
      shown.games.achievements.map((a: { name: string }) => a.name),
    ).toEqual(["First blood"]);
  });

  it("the consent names pictures, achievements and days", async () => {
    api.list.mockResolvedValue({ steam: { available: true } });
    mount();
    await flush();
    button("Connect Steam")!.click();
    await flush();
    expect(text()).toContain("up to 60 of your latest achievements");
    expect(text()).toContain("no time of day");
    expect(text()).toContain("so Steam does not see who views your profile");
    expect(text()).toContain("The unlock days show when you played.");
  });
});
