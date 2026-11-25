import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProfileTiles, ProfileTilesMore } from "./ProfileTiles";
import {
  type ProfileSize,
  ProfileSizeContext,
  ProfileWidthContext,
} from "./profileSize";

const tiles = ["Moon halo", "Falling stars", "Egypt", "Crystal cave"].map(
  (name) => ({
    key: name,
    name,
    note: "Decoration",
    picture: <span />,
    onPress: () => {},
  }),
);

let dispose: (() => void) | undefined;

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.innerHTML = '<div id="root"></div>';
});
afterEach(() => dispose?.());

/** Wearing as the profile draws it, in a profile this wide */
function mount(size: ProfileSize, width?: number) {
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <ProfileSizeContext.Provider value={() => size}>
          <ProfileWidthContext.Provider value={() => width}>
            <ProfileTilesMore
              count={tiles.length}
              open={false}
              onPress={() => {}}
            />
            <ProfileTiles tiles={tiles} />
          </ProfileWidthContext.Provider>
        </ProfileSizeContext.Provider>
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );
  const grid = document.querySelector<HTMLElement>("[style*='--tiles']")!;
  return {
    perRow: grid.style.getPropertyValue("--tiles"),
    shown: grid.querySelectorAll("button").length,
    narrow: grid.hasAttribute("data-narrow"),
    more: [...document.querySelectorAll("button")].some(
      (b) => b.textContent === "Show more",
    ),
  };
}

describe("Wearing and creations tiles", () => {
  it("the full profile on a desktop keeps four in a row", () => {
    expect(mount("full", 428)).toEqual({
      perRow: "4",
      shown: 4,
      more: false,
      narrow: false,
    });
  });

  it("the full profile on a phone without a frame keeps four", () => {
    expect(mount("full", 343)).toEqual({
      perRow: "4",
      shown: 4,
      more: false,
      narrow: false,
    });
  });

  it("a narrow framed profile on a phone shows three, with Show more", () => {
    // 375 px screen, frame room 28 + 12 each side, 16 px padding each side
    expect(mount("full", 263)).toEqual({
      perRow: "3",
      shown: 3,
      more: true,
      narrow: true,
    });
  });

  it("the card keeps three at any width", () => {
    expect(mount("card", 328)).toEqual({
      perRow: "3",
      shown: 3,
      more: true,
      narrow: false,
    });
  });

  it("a framed card on a phone (inset from the edges) gives names two lines", () => {
    // 375 px screen, frame room and 12 px on each side: 263 px of content;
    // names were cut short there ("Moon h…", "Falling s…")
    expect(mount("card", 263)).toEqual({
      perRow: "3",
      shown: 3,
      more: true,
      narrow: true,
    });
  });

  it("before the profile is measured, the size alone decides", () => {
    expect(mount("full")).toEqual({
      perRow: "4",
      shown: 4,
      more: false,
      narrow: false,
    });
  });
});

describe("Wearing: wide designs and square ones", () => {
  const plate = {
    key: "Nameplate",
    name: "Aurora",
    note: "Nameplate",
    wide: true,
    picture: <span data-worn-plate />,
    onPress: () => {},
  };

  function mountWorn(size: ProfileSize, list = [plate, ...tiles], all = false) {
    dispose = render(
      () => (
        <I18nProvider i18n={i18n}>
          <ProfileSizeContext.Provider value={() => size}>
            <ProfileWidthContext.Provider value={() => undefined}>
              <ProfileTiles tiles={list} all={all} />
            </ProfileWidthContext.Provider>
          </ProfileSizeContext.Provider>
        </I18nProvider>
      ),
      document.getElementById("root")!,
    );
    const buttons = [...document.querySelectorAll("button")];
    const grid = document.querySelector<HTMLElement>("[style*='--tiles']");
    return { buttons, grid };
  }

  it("a nameplate takes a row of its own, first, outside the square row", () => {
    const { buttons, grid } = mountWorn("full");
    expect(buttons[0].title).toBe("Aurora");
    expect(buttons[0].hasAttribute("data-wide")).toBe(true);
    // the plate is drawn whole, not squeezed into the 48 px picture box
    expect(buttons[0].firstElementChild?.hasAttribute("data-worn-plate")).toBe(
      true,
    );
    expect(grid!.contains(buttons[0])).toBe(false);
    // four square designs side by side on the full profile
    expect(grid!.querySelectorAll("button")).toHaveLength(4);
  });

  it("on the card the plate stays, and the squares keep their three", () => {
    const { buttons, grid } = mountWorn("card");
    expect(buttons.filter((b) => b.hasAttribute("data-wide"))).toHaveLength(1);
    expect(grid!.querySelectorAll("button")).toHaveLength(3);
  });

  it("each tile keeps its name and its kind", () => {
    const { buttons } = mountWorn("full");
    expect(buttons[0].querySelector("bdi")!.textContent).toBe("Aurora");
    expect(buttons[0].textContent).toContain("Nameplate");
    expect(buttons[1].querySelector("bdi")!.textContent).toBe("Moon halo");
  });

  it("only a nameplate: no empty square row", () => {
    const { buttons, grid } = mountWorn("card", [plate]);
    expect(buttons).toHaveLength(1);
    expect(grid).toBeNull();
  });
});
