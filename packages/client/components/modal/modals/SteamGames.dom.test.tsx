import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/ui", () => ({
  Dialog: (props: { title?: unknown; children?: unknown }) => (
    <div role="dialog">
      <h2>{props.title as never}</h2>
      {props.children as never}
    </div>
  ),
  Button: (props: { children?: unknown; onPress?: () => void }) => (
    <button type="button" onClick={() => props.onPress?.()}>
      {props.children as never}
    </button>
  ),
  // a stand-in for the design-system select, enough to drive the filter
  FloatingSelect: (props: {
    label?: string;
    value?: string;
    children?: unknown;
    onChange?: (event: { currentTarget: { value: string } }) => void;
  }) => (
    <div data-select aria-label={props.label}>
      {props.children as never}
      <input
        data-filter
        value={props.value}
        onInput={(event) =>
          props.onChange?.({
            currentTarget: { value: event.currentTarget.value },
          })
        }
      />
    </div>
  ),
  MenuItem: (props: { value: string; children?: unknown }) => (
    <span data-option={props.value}>{props.children as never}</span>
  ),
}));
vi.mock("@revolt/ui/components/features/profiles/SteamTile", () => ({
  SteamTile: (props: { url?: string }) => <span data-tile={props.url ?? ""} />,
}));
const openModal = vi.fn();
vi.mock("..", () => ({ useModals: () => ({ openModal }) }));

import { SteamGamesModal } from "./SteamGames";

const games = {
  service: "steam",
  display_name: "MAHER",
  profile_url: "https://steamcommunity.com/id/maher/",
  private: false,
  game_count: 32,
  total_hours: 4120,
  games: [
    {
      appid: 570,
      name: "Dota 2",
      hours: 210,
      achievements_unlocked: 12,
      achievements_total: 30,
      header_url: "https://cdn.cloudflare.steamstatic.com/steam/apps/570/header.jpg",
      store_url: "https://store.steampowered.com/app/570/",
    },
    {
      appid: 620,
      name: "Portal 2",
      hours: 42,
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
};

let dispose: (() => void) | undefined;
const text = () => document.body.textContent ?? "";

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.replaceChildren(document.createElement("div"));
  openModal.mockReset();
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <SteamGamesModal
          type="steam_games"
          games={games}
          show
          onClose={() => {}}
        />
      </I18nProvider>
    ),
    document.body.firstElementChild as HTMLElement,
  );
});
afterEach(() => dispose?.());

describe("SteamGamesModal", () => {
  it("shows the person, the games and the latest achievements with days", () => {
    expect(text()).toContain("MAHER");
    expect(text()).toContain("32 games");
    expect(text()).toContain("4,120 hours played");
    expect(text()).toContain("2 recent achievements");
    expect(text()).toContain("12 of 30 achievements");
    expect(text()).toContain("First blood");
    expect(text()).toContain("Nov 12, 2026");
    expect(text()).toContain("belong to their owners");
  });

  it("filters achievements by game", () => {
    const filter = document.querySelector<HTMLInputElement>("[data-filter]")!;
    filter.value = "620";
    filter.dispatchEvent(new Event("input", { bubbles: true }));
    expect(text()).toContain("Wake up call");
    expect(text()).not.toContain("First blood");
  });

  it("opens Steam pages only through the link warning", () => {
    [...document.querySelectorAll("button")]
      .find((el) => el.textContent?.includes("Dota 2"))!
      .click();
    expect(openModal).toHaveBeenCalledWith(
      expect.objectContaining({ type: "link_warning" }),
    );
    expect(openModal.mock.calls[0][0].url.hostname).toBe(
      "store.steampowered.com",
    );
  });

  it("a game without a header picture still gets a tile", () => {
    const tiles = [...document.querySelectorAll("[data-tile]")];
    expect(tiles.some((tile) => tile.getAttribute("data-tile") === "")).toBe(
      true,
    );
  });
});
