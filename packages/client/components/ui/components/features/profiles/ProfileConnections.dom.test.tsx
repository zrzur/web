import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openModal = vi.fn();
vi.mock("@revolt/modal", () => ({ useModals: () => ({ openModal }) }));

import { connectionInterests } from "./ProfileConnections";
import { ProfileInterests } from "./ProfileInterests";
import type { ProfileConnection } from "./linkedServices";
import { type ProfileSize, ProfileSizeContext } from "./profileSize";

const repos = [1, 2, 3, 4].map((id) => ({
  id,
  name: `repo-${id}`,
  stars: 10 * id,
  url: `https://github.com/dev/repo-${id}`,
}));

const connections: ProfileConnection[] = [
  {
    service: "twitch",
    display_name: "MaherLive",
    profile_url: "https://www.twitch.tv/maherlive",
    live: true,
    live_title: "Ranked nights",
  },
  { service: "github", display_name: "dev", profile_url: "https://github.com/dev", repos },
  { service: "battlenet", display_name: "Maher#21794", profile_url: "" },
];

let dispose: (() => void) | undefined;

function mount(list: ProfileConnection[], size: ProfileSize = "card") {
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <ProfileSizeContext.Provider value={() => size}>
          <ProfileInterests interests={connectionInterests(list)} />
        </ProfileSizeContext.Provider>
      </I18nProvider>
    ),
    document.body.firstElementChild as HTMLElement,
  );
}

const text = () => document.body.textContent ?? "";
const tab = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("[role=tab]")].find(
    (el) => el.textContent === name,
  )!;

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.replaceChildren(document.createElement("div"));
  openModal.mockReset();
});
afterEach(() => dispose?.());

describe("linked services in Interests", () => {
  it("gives each service its own tab, the first one open", () => {
    mount(connections);
    const tabs = [...document.querySelectorAll("[role=tab]")].map((el) => el.textContent);
    expect(tabs).toEqual(["Twitch", "GitHub", "Battle.net"]);
    expect(text()).toContain("MaherLive");
    expect(text()).toContain("Live now");
    expect(text()).toContain("Ranked nights");
    expect(text()).not.toContain("repo-1");
  });

  it("shows three repositories on the card and all on the full profile", () => {
    mount(connections);
    tab("GitHub").click();
    expect(document.querySelectorAll("li")).toHaveLength(3);
    dispose?.();
    document.body.replaceChildren(document.createElement("div"));
    mount(connections, "full");
    tab("GitHub").click();
    expect(document.querySelectorAll("li")).toHaveLength(4);
  });

  it("opens links only through the link warning", () => {
    mount(connections);
    [...document.querySelectorAll("button")].find((b) => b.textContent === "MaherLive")!.click();
    expect(openModal).toHaveBeenCalledWith(
      expect.objectContaining({ type: "link_warning" }),
    );
  });

  it("names Battle.net as the BattleTag's source, with a copy button", () => {
    mount(connections);
    tab("Battle.net").click();
    expect(text()).toContain("Maher#21794");
    expect(text()).toContain("BattleTag from Battle.net");
    expect(document.querySelector("[aria-label='Copy BattleTag']")).toBeTruthy();
  });

  it("one service fills the section without tabs", () => {
    mount([connections[2]]);
    expect(document.querySelectorAll("[role=tab]")).toHaveLength(0);
    expect(text()).toContain("Maher#21794");
  });
});
