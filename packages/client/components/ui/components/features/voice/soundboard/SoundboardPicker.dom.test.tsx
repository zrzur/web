import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/ui/components/design", () => ({
  IconButton: (props: {
    children?: unknown;
    onPress?: () => void;
    "aria-label"?: string;
  }) => (
    <button
      type="button"
      aria-label={props["aria-label"]}
      onClick={() => props.onPress?.()}
    >
      {props.children as string}
    </button>
  ),
}));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <i /> }));
vi.mock("@revolt/markdown", () => ({
  TextWithEmoji: (props: { content: string }) => <span>{props.content}</span>,
}));
vi.mock("@revolt/client", () => ({ useClient: () => () => ({}) }));
vi.mock("@revolt/i18n", () => ({
  useError: () => (err: unknown) => `plain: ${String(err)}`,
}));

const played: string[] = [];
let sounds: { _id: string; name: string; emoji?: string }[] = [];
vi.mock("@revolt/rtc/voiceExtrasStore", () => ({
  followVoiceEvents: () => {},
  soundboardOf: () => ({
    load: async () => true,
    sounds: { values: () => sounds.values() },
  }),
  playSound: vi.fn(async (_client: unknown, _channel: unknown, id: string) => {
    played.push(id);
  }),
}));
const closed: boolean[] = [];
vi.mock("./soundboardOpen", () => ({
  setSoundboardOpen: (open: boolean) => closed.push(!open),
}));

import SoundboardPicker, { SOUNDBOARD_FIRST } from "./SoundboardPicker";

let dispose: (() => void) | undefined;
function mount() {
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <SoundboardPicker channel={{ server: { id: "s" } } as never} />
      </I18nProvider>
    ),
    document.body.firstElementChild as HTMLElement,
  );
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const tiles = () => document.querySelectorAll("[data-sound]");

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.replaceChildren(document.createElement("div"));
  played.length = 0;
  closed.length = 0;
  sounds = Array.from({ length: 8 }, (_, i) => ({
    _id: `s${i}`,
    name: `sound ${i}`,
    emoji: i % 2 ? "🎺" : undefined,
  }));
});
afterEach(() => dispose?.());

describe("soundboard card", () => {
  it("shows two rows first, then every sound after See all", async () => {
    mount();
    await flush();
    expect(tiles().length).toBe(SOUNDBOARD_FIRST);
    const more = document.querySelector<HTMLButtonElement>(
      "[data-soundboard-all]",
    )!;
    expect(more.textContent).toBe("See all");
    more.click();
    await flush();
    expect(tiles().length).toBe(8);
    expect(more.textContent).toBe("Show less");
  });

  it("has no See all when every sound fits", async () => {
    sounds = sounds.slice(0, 4);
    mount();
    await flush();
    expect(tiles().length).toBe(4);
    expect(document.querySelector("[data-soundboard-all]")).toBeNull();
  });

  it("plays the pressed sound for the call", async () => {
    mount();
    await flush();
    (tiles()[1] as HTMLButtonElement).click();
    await flush();
    expect(played).toEqual(["s1"]);
    expect(tiles()[1].textContent).toContain("🎺");
  });

  it("closes with Escape", async () => {
    mount();
    await flush();
    document
      .querySelector("[data-soundboard]")!
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    expect(closed).toEqual([true]);
  });
});
