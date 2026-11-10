import { beforeEach, describe, expect, it, vi } from "vitest";

const loaded = vi.hoisted(() => ({ count: 0 }));
vi.mock("../../floating/UserCard", () => (loaded.count++, {}));
vi.mock("./ProfileBotAbout", () => (loaded.count++, {}));
vi.mock("./ProfileOwner", () => (loaded.count++, {}));
vi.mock("./ProfileCommands", () => (loaded.count++, {}));

describe("preloading a bot's card", () => {
  beforeEach(() => vi.resetModules());

  it("starts the card and the bot sections at the press, once", async () => {
    const { preloadBotCard } = await import("./preloadBotCard");
    loaded.count = 0;
    await Promise.all([preloadBotCard(), preloadBotCard(), preloadBotCard()]);
    expect(loaded.count).toBe(4);
    // one promise for every press: no work after the first
    expect(preloadBotCard()).toBe(preloadBotCard());
  });
});
