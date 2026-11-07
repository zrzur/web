import { beforeEach, describe, expect, it, vi } from "vitest";

const site = vi.hoisted(() => ({ designs: false, discover: false }));

vi.mock("../../siteHost", () => ({
  isDesignsSite: () => site.designs,
  isDiscoverSite: () => site.discover,
}));

import { goingHome } from "./goingHome";

beforeEach(() => {
  site.designs = false;
  site.discover = false;
});

describe("goingHome", () => {
  it("is true for the addresses of Home in the app", () => {
    expect(goingHome("/")).toBe(true);
    expect(goingHome("/app")).toBe(true);
  });

  it("is false for any other page", () => {
    expect(goingHome("/friends")).toBe(false);
    expect(goingHome("/server/1/channel/2")).toBe(false);
  });

  it("is false on the standalone sites, whose root is their own page", () => {
    site.designs = true;
    expect(goingHome("/")).toBe(false);
    site.designs = false;
    site.discover = true;
    expect(goingHome("/")).toBe(false);
  });
});
