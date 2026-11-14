import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
});

const load = async () => {
  vi.resetModules();
  return import("./embedSettings");
};

beforeEach(() => store.clear());

describe("media player consent", () => {
  it("asks each site once and remembers it after a reload", async () => {
    const first = await load();
    expect(first.isMediaPlayerAllowed("YouTube")).toBe(false);
    first.allowMediaPlayer("YouTube");
    first.allowMediaPlayer("YouTube");
    expect(first.allowedMediaPlayers()).toEqual(["YouTube"]);

    const second = await load();
    expect(second.isMediaPlayerAllowed("YouTube")).toBe(true);
    expect(second.isMediaPlayerAllowed("Spotify")).toBe(false);
  });

  it("can be taken back", async () => {
    const first = await load();
    first.allowMediaPlayer("Streamable");
    first.forgetMediaPlayers();
    expect((await load()).isMediaPlayerAllowed("Streamable")).toBe(false);
  });
});

describe("players of the Player kind", () => {
  it("have one consent per site, named for people", async () => {
    const { playerKey, playerProvider } = await import("./embedSettings");
    expect(playerKey({ type: "Player", provider: "Vimeo" })).toBe("Player:Vimeo");
    expect(playerKey({ type: "Spotify" })).toBe("Spotify");
    expect(playerKey(undefined)).toBeUndefined();
    expect(playerProvider("Player:TikTok")).toEqual({
      name: "TikTok",
      company: "TikTok (ByteDance)",
    });
    expect(playerProvider("YouTube")?.company).toBe("Google");
  });
});
