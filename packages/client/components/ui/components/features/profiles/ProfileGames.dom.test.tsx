import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./SteamTile", () => ({
  SteamTile: (props: { url?: string; name: string }) => (
    <span data-tile={props.url ?? ""} data-name={props.name} />
  ),
}));
const openModal = vi.fn();
vi.mock("@revolt/modal", () => ({ useModals: () => ({ openModal }) }));

import { ProfileGamesPanel } from "./ProfileGames";
import { ProfileInterests } from "./ProfileInterests";
import type { ProfileGames } from "./linkedGames";
import { ProfileSizeContext } from "./profileSize";

const game = (appid: number, name: string, hours: number) => ({
  appid,
  name,
  hours,
  icon_url: `https://media.steampowered.com/icons/${appid}.jpg`,
  store_url: `https://store.steampowered.com/app/${appid}/`,
});

const games: ProfileGames = {
  service: "steam",
  display_name: "MAHER",
  profile_url: "https://steamcommunity.com/id/maher/",
  private: false,
  game_count: 19,
  total_hours: 1484,
  games: [
    game(1, "Rust", 296),
    game(2, "Counter-Strike 2", 65),
    game(3, "Farlight 84", 38),
    game(4, "PEAK", 21),
    game(5, "Trackmania", 12),
  ],
  achievements: Array.from({ length: 30 }, (_, i) => ({
    appid: 1,
    game: "Rust",
    name: `Achievement ${i + 1}`,
    description: "",
    unlocked_on: "2026-11-12",
  })),
};

let dispose: (() => void) | undefined;
const text = () => document.body.textContent ?? "";
const button = (label: string) =>
  [...document.querySelectorAll("button")].find(
    (el) => el.textContent?.trim() === label,
  );
const rows = () =>
  [...document.querySelectorAll("[data-testid=profile-games] ul")][0]?.children
    .length ?? 0;

function show(data: ProfileGames, size: "card" | "full" = "card") {
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <ProfileSizeContext.Provider value={() => size}>
          <ProfileGamesPanel games={data} />
        </ProfileSizeContext.Provider>
      </I18nProvider>
    ),
    document.body.firstElementChild as HTMLElement,
  );
}

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.replaceChildren(document.createElement("div"));
  openModal.mockReset();
});
afterEach(() => dispose?.());

describe("ProfileGamesPanel", () => {
  it("shows who, how many games and hours, and the three most played", () => {
    show(games);
    expect(text()).toContain("MAHER");
    expect(text()).toContain("19 games");
    expect(text()).toContain("1,484 h");
    expect(text()).toContain("From Steam");
    expect(rows()).toBe(3);
    expect(text()).toContain("296 h");
    expect(text()).not.toContain("Trackmania");
  });

  it("Show all opens the rest in place, Show less closes it", () => {
    show(games);
    const more = button("Show all 5")!;
    expect(more.getAttribute("aria-expanded")).toBe("false");
    more.click();
    expect(rows()).toBe(5);
    expect(text()).toContain("Trackmania");
    const less = button("Show less")!;
    expect(less.getAttribute("aria-expanded")).toBe("true");
    less.click();
    expect(rows()).toBe(3);
  });

  it("has no Show all for three games or fewer", () => {
    show({ ...games, games: games.games.slice(0, 3) });
    expect(button("Show all 3")).toBeUndefined();
  });

  it("View opens the games dialog with the same data", () => {
    show(games);
    button("View")!.click();
    expect(openModal).toHaveBeenCalledWith({ type: "steam_games", games });
  });

  it("the Steam name opens Steam only through the link warning", () => {
    show(games);
    button("MAHER")!.click();
    const call = openModal.mock.calls[0][0];
    expect(call.type).toBe("link_warning");
    expect(call.url.hostname).toBe("steamcommunity.com");
  });

  it("a name with an address that is not Steam's is plain text", () => {
    show({ ...games, profile_url: "https://example.com/id/maher/" });
    expect(button("MAHER")).toBeUndefined();
    expect(text()).toContain("MAHER");
  });

  it("the card shows two rows of achievements, the full profile more", () => {
    show(games);
    expect(document.querySelectorAll("li[title]").length).toBe(14);
    dispose?.();
    document.body.replaceChildren(document.createElement("div"));
    show(games, "full");
    expect(document.querySelectorAll("li[title]").length).toBe(22);
  });

  it("every achievement has a name a screen reader can read", () => {
    show(games);
    const first = document.querySelector("li[title]")!;
    expect(first.textContent).toContain("Achievement 1 · Rust");
  });

  it("a private account shows one line and nothing else", () => {
    show({
      ...games,
      private: true,
      display_name: "",
      profile_url: "",
      games: [],
      achievements: [],
    });
    expect(text()).toContain("This Steam account is private.");
    expect(button("View")).toBeUndefined();
    expect(text()).not.toContain("games");
  });

  it("says so when every game is hidden", () => {
    show({ ...games, games: [], achievements: [] });
    expect(text()).toContain("No games to show.");
    expect(text()).toContain("MAHER");
  });
});

describe("ProfileInterests", () => {
  const two = [
    { id: "games", label: "Games", panel: () => <p>games panel</p> },
    { id: "streams", label: "Streams", panel: () => <p>streams panel</p> },
  ];
  const tabs = () => [...document.querySelectorAll<HTMLElement>("[role=tab]")];

  function showInterests(interests: typeof two) {
    dispose = render(
      () => (
        <I18nProvider i18n={i18n}>
          <ProfileInterests interests={interests} />
        </I18nProvider>
      ),
      document.body.firstElementChild as HTMLElement,
    );
  }

  it("one service fills the section, with no tabs", () => {
    showInterests(two.slice(0, 1));
    expect(text()).toContain("Interests");
    expect(text()).toContain("games panel");
    expect(tabs().length).toBe(0);
  });

  it("nothing linked draws nothing", () => {
    showInterests([]);
    expect(text()).toBe("");
  });

  it("two services get tabs; the first is open and a press switches", () => {
    showInterests(two);
    expect(tabs().map((tab) => tab.textContent)).toEqual(["Games", "Streams"]);
    expect(tabs()[0].getAttribute("aria-selected")).toBe("true");
    expect(text()).toContain("games panel");
    tabs()[1].click();
    expect(tabs()[1].getAttribute("aria-selected")).toBe("true");
    expect(tabs()[0].tabIndex).toBe(-1);
    expect(text()).toContain("streams panel");
    expect(text()).not.toContain("games panel");
  });

  it("the arrow keys move between tabs", () => {
    showInterests(two);
    tabs()[0].focus();
    tabs()[0].dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect(tabs()[1].getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tabs()[1]);
  });
});
