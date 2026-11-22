import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openModal = vi.fn();
vi.mock("@revolt/modal", () => ({ useModals: () => ({ openModal }) }));
vi.mock("@revolt/client", () => ({
  useClient: () => () => ({ proxyFile: (url: string) => `https://proxy.test/?u=${url}` }),
}));
vi.mock("@revolt/ui/icons/Icon", () => ({
  Icon: (props: { name: string }) => <i data-icon={props.name} />,
}));

import { connectionInterests } from "./ProfileConnections";
import { ProfileInterests } from "./ProfileInterests";
import type { ProfileConnection } from "./linkedServices";
import { type ProfileSize, ProfileSizeContext } from "./profileSize";

const repos = [1, 2, 3, 4].map((id) => ({
  id,
  name: `repo-${id}`,
  language: "Rust",
  stars: 10 * id,
  url: `https://github.com/dev/repo-${id}`,
}));

const twitch: ProfileConnection = {
  service: "twitch",
  display_name: "MaherLive",
  profile_url: "https://www.twitch.tv/maherlive",
  avatar_url: "https://static-cdn.jtvnw.net/jtv_user_pictures/a.png",
  bio: "Ranked nights",
  kind: "partner",
  live: true,
  live_title: "Ranked nights, chill talk",
  game: "Rust",
};
const github: ProfileConnection = {
  service: "github",
  display_name: "maher-xs",
  profile_url: "https://github.com/maher-xs",
  avatar_url: "https://evil.example/a.png",
  followers: 128,
  public_repos: 42,
  repos,
};
const battlenet: ProfileConnection = {
  service: "battlenet",
  display_name: "BlueLoa#25624",
  profile_url: "",
};

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
const button = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (el) => el.textContent?.trim() === name,
  );

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.replaceChildren(document.createElement("div"));
  openModal.mockReset();
});
afterEach(() => dispose?.());

describe("linked services in Interests", () => {
  it("gives each service its own tab, the first one open", () => {
    mount([twitch, github, battlenet]);
    const tabs = [...document.querySelectorAll("[role=tab]")].map((el) => el.textContent);
    expect(tabs).toEqual(["Twitch", "GitHub", "Battle.net"]);
    expect(tab("Twitch").getAttribute("aria-selected")).toBe("true");
  });

  it("Twitch: picture through the proxy, partner, bio, live with title and game", () => {
    mount([twitch]);
    const img = document.querySelector("img")!;
    expect(img.getAttribute("src")).toBe(
      "https://proxy.test/?u=https://static-cdn.jtvnw.net/jtv_user_pictures/a.png",
    );
    expect(text()).toContain("Partner · From Twitch");
    expect(text()).toContain("Ranked nights");
    expect(text()).toContain("Live now");
    expect(text()).toContain("Ranked nights, chill talk");
    expect(text()).toContain("Rust");
    button("View")!.click();
    expect(openModal).toHaveBeenCalledWith(
      expect.objectContaining({ type: "link_warning" }),
    );
  });

  it("Twitch offline: the last stream's category as a row", () => {
    mount([{ ...twitch, live: false, live_title: undefined }]);
    expect(text()).not.toContain("Live now");
    expect(text()).toContain("Last stream");
  });

  it("GitHub: counts, no picture from another host, three repos then Show all", () => {
    mount([github]);
    expect(text()).toContain("128 followers · 42 repositories · From GitHub");
    // a picture outside avatars.githubusercontent.com is never loaded
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelectorAll("li")).toHaveLength(3);
    expect(text()).toContain("Rust · 30 stars");
    expect(text()).not.toContain("40 stars");
    button("Show all 4")!.click();
    expect(document.querySelectorAll("li")).toHaveLength(4);
    expect(text()).toContain("Rust · 40 stars");
  });

  it("GitHub on the full profile shows every picked repository", () => {
    mount([github], "full");
    expect(document.querySelectorAll("li")).toHaveLength(4);
    expect(button("Show all 4")).toBeUndefined();
  });

  it("Battle.net: the number set apart, copy as an icon with feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    mount([battlenet]);
    expect(text()).toContain("BlueLoa#25624");
    expect(text()).toContain("From Battle.net");
    // no "Copy" word on screen
    expect(button("Copy")).toBeUndefined();
    const copy = document.querySelector<HTMLButtonElement>("[aria-label='Copy BattleTag']")!;
    expect(copy.querySelector("[data-icon=copy]")).toBeTruthy();
    copy.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith("BlueLoa#25624");
    expect(document.querySelector("[aria-label='Copied']")).toBeTruthy();
    expect(document.querySelector("[role=status]")?.textContent).toBe("Copied");
  });

  it("one service fills the section without tabs", () => {
    mount([battlenet]);
    expect(document.querySelectorAll("[role=tab]")).toHaveLength(0);
  });
});
