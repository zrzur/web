import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { ReactiveMap } from "@solid-primitives/map";
import { For, JSX, splitProps } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The Library tab opens at once: the soundboard page starts the library
// list request and loads the tab's chunk as it opens, and asks again on
// hover or focus of the tabs when the first try failed.

const fetchSoundLibrary = vi.fn(async () => ({ categories: [], sounds: [] }));
const chunkLoaded = vi.fn();

vi.mock("./SoundLibrary", () => {
  chunkLoaded();
  return { default: () => <div data-sound-library /> };
});
vi.mock("@revolt/rtc/voiceExtrasStore", () => ({
  SoundboardPlayer: class {
    play = vi.fn();
    stopAll = vi.fn();
  },
  createSound: vi.fn(),
  deleteSound: vi.fn(),
  fetchSoundLibrary: () => fetchSoundLibrary(),
  followVoiceEvents: vi.fn(),
  soundGain: () => 1,
  soundUrl: () => "",
  soundboardOf: () => ({
    sounds: new ReactiveMap(),
    limit: () => 8,
    load: async () => undefined,
  }),
}));
vi.mock("@revolt/client", () => ({ useClient: () => () => ({}) }));
vi.mock("@revolt/i18n", () => ({ useError: () => () => "error" }));
vi.mock("@revolt/instance", () => ({
  useInstance: () => ({
    limits: () => ({ file_upload_size_limits: {} }),
    mediaUrl: "https://cdn",
  }),
}));
vi.mock("@revolt/markdown", () => ({ TextWithEmoji: () => <span /> }));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <i /> }));
vi.mock("@revolt/ui", () => {
  const Button = (props: Record<string, unknown>) => {
    const [local, rest] = splitProps(props, [
      "children",
      "onPress",
      "size",
      "variant",
      "isDisabled",
    ]);
    return (
      <button
        {...(rest as object)}
        onClick={() => (local.onPress as () => void)?.()}
      >
        {local.children as JSX.Element}
      </button>
    );
  };
  const Box = (props: {
    children?: JSX.Element;
    title?: JSX.Element;
    description?: JSX.Element;
  }) => (
    <section>
      {props.title}
      {props.description}
      {props.children}
    </section>
  );
  return {
    Button,
    IconButton: Button,
    Column: Box,
    SettingsSection: Box,
    SettingsRow: Box,
    TextField: () => <input />,
    Segmented: (props: {
      value: string;
      options: { value: string; label: string }[];
      onChange: (value: string) => void;
    }) => (
      <div role="radiogroup">
        <For each={props.options}>
          {(option) => (
            <button
              role="radio"
              aria-checked={option.value === props.value}
              onClick={() => props.onChange(option.value)}
            >
              {option.label}
            </button>
          )}
        </For>
      </div>
    ),
  };
});

import { SoundboardList } from "./SoundboardList";

let dispose: (() => void) | undefined;
let root: HTMLDivElement;

beforeEach(() => {
  root = document.createElement("div");
  document.body.append(root);
  fetchSoundLibrary.mockClear();
  i18n.loadAndActivate({ locale: "en", messages: {} });
});
afterEach(() => {
  dispose?.();
  root.remove();
});

function show() {
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <SoundboardList
          server={{ id: "SV", havePermission: () => true } as never}
        />
      </I18nProvider>
    ),
    root,
  );
}

describe("soundboard page", () => {
  it("fetches the library list and its chunk as the page opens", async () => {
    show();
    expect(fetchSoundLibrary).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(chunkLoaded).toHaveBeenCalled());
    // the Upload tab is shown; the library is ready behind its tab
    expect(root.querySelector("[data-sound-library]")).toBeNull();
    (root.querySelector('[role="radio"]:last-child') as HTMLElement).click();
    await vi.waitFor(() =>
      expect(root.querySelector("[data-sound-library]")).not.toBeNull(),
    );
  });

  it("asks again on hover or focus of the tabs", async () => {
    fetchSoundLibrary.mockRejectedValueOnce(new Error("offline"));
    show();
    expect(fetchSoundLibrary).toHaveBeenCalledTimes(1);
    const tabs = root.querySelector('[role="radiogroup"]')!.parentElement!;
    tabs.dispatchEvent(new MouseEvent("pointerenter"));
    expect(fetchSoundLibrary).toHaveBeenCalledTimes(2);
    tabs.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(fetchSoundLibrary).toHaveBeenCalledTimes(3);
  });
});
