import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { ReactiveMap } from "@solid-primitives/map";
import { JSX, splitProps } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  searchSoundLibrary,
  soundLibraryName,
} from "../../../../../../../stoat.js/src/solid/voiceExtras";

import SoundLibrary from "./SoundLibrary";

// The sound library tab: categories, search in the page language and in
// English, one preview at a time at the soundboard volume, Add with an
// editable name, "Added" for sounds the server has, no Add without Manage
// Soundboard, and paging.

const library = {
  categories: [
    {
      id: "voice",
      names: { en: "Voice lines (English)", ar: "عبارات صوتية (بالإنجليزية)" },
    },
    { id: "alerts", names: { en: "Alerts", ar: "تنبيهات" } },
  ],
  sounds: [
    {
      id: "voice-go",
      category: "voice",
      emoji: "🏁",
      duration_ms: 500,
      size: 6000,
      version: "abcdef012345",
      names: { en: "“Go”", ar: "«Go»: انطلق", de: "„Go“: Los" },
    },
    {
      id: "alert-success",
      category: "alerts",
      emoji: "✔️",
      duration_ms: 700,
      size: 7000,
      version: "0123456789ab",
      names: { en: "Success", ar: "نجاح", de: "Erfolg" },
    },
    {
      id: "alert-error",
      category: "alerts",
      emoji: "⛔",
      duration_ms: 400,
      size: 5000,
      version: "fedcba987654",
      names: { en: "Error", ar: "خطأ", de: "Fehler" },
    },
  ],
};

const play = vi.fn(async () => undefined);
const stopAll = vi.fn();
const addLibrarySound = vi.fn();
const fetchSoundLibrary = vi.fn(async () => library);
let volume = 0.5;

vi.mock("@revolt/rtc/voiceExtrasStore", () => ({
  SoundboardPlayer: class {
    play = play;
    stopAll = stopAll;
  },
  addLibrarySound: (...args: unknown[]) => addLibrarySound(...args),
  fetchSoundLibrary: () => fetchSoundLibrary(),
  searchSoundLibrary: (...args: Parameters<typeof searchSoundLibrary>) =>
    searchSoundLibrary(...args),
  soundLibraryName: (...args: Parameters<typeof soundLibraryName>) =>
    soundLibraryName(...args),
  soundLibraryPreviewUrl: (
    _client: unknown,
    sound: { id: string; version: string },
  ) => `https://api/soundboard/library/${sound.id}/audio?v=${sound.version}`,
  soundGain: (own: number, listener: number) => (own / 100) * listener,
  soundboardChoices: () => ({ muted: false, volume }),
}));
vi.mock("@revolt/client", () => ({ useClient: () => () => ({}) }));
vi.mock("@revolt/i18n", () => ({
  useError: () => (err: { type?: string }) => `error:${err?.type ?? "unknown"}`,
}));
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
        disabled={local.isDisabled as boolean}
        onClick={() => (local.onPress as () => void)?.()}
      >
        {local.children as JSX.Element}
      </button>
    );
  };
  return {
    Button,
    IconButton: Button,
    MenuItem: (props: { value: string; children: JSX.Element }) => (
      // no native option element: the CI check refuses one anywhere in components
      <div role="option" data-value={props.value}>
        {props.children}
      </div>
    ),
    // a design-system select; a plain list of options here
    FloatingSelect: (props: {
      label: string;
      value: string;
      children: JSX.Element;
      onChange: (event: {
        currentTarget: { value: string; textContent: string };
      }) => void;
    }) => (
      <div data-select={props.label}>
        <span data-value>{props.value}</span>
        <div
          onClick={(event) => {
            const value = (event.target as HTMLElement).getAttribute(
              "data-value",
            );
            if (value !== null)
              props.onChange({ currentTarget: { value, textContent: "" } });
          }}
        >
          {props.children}
        </div>
      </div>
    ),
    TextField: (props: {
      label: string;
      name: string;
      value: string;
      onInput: (event: { currentTarget: { value: string } }) => void;
    }) => (
      <input
        aria-label={props.label}
        name={props.name}
        value={props.value}
        onInput={(event) =>
          props.onInput({ currentTarget: event.currentTarget })
        }
      />
    ),
  };
});

let dispose: (() => void) | undefined;
let root: HTMLDivElement;

function board(sounds: { _id: string; library_id?: string }[] = [], limit = 8) {
  const map = new ReactiveMap<string, never>();
  for (const sound of sounds) map.set(sound._id, sound as never);
  return { sounds: map, limit: () => limit, load: async () => undefined };
}

async function show(
  options: {
    canAdd?: boolean;
    entry?: ReturnType<typeof board>;
    locale?: string;
  } = {},
) {
  i18n.loadAndActivate({ locale: options.locale ?? "en", messages: {} });
  const entry = options.entry ?? board();
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <SoundLibrary
          server={{ id: "SV" } as never}
          board={entry as never}
          canAdd={options.canAdd ?? true}
        />
      </I18nProvider>
    ),
    root,
  );
  await vi.waitFor(() =>
    expect(root.querySelector("[data-library-sound]")).not.toBeNull(),
  );
  return entry;
}

const rows = () =>
  [...root.querySelectorAll("[data-library-sound]")].map((row) =>
    row.getAttribute("data-library-sound"),
  );

function type(name: string, value: string) {
  const input = root.querySelector(`input[name="${name}"]`) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new InputEvent("input", { bubbles: true }));
}

beforeEach(() => {
  root = document.createElement("div");
  document.body.append(root);
  vi.clearAllMocks();
  volume = 0.5;
});
afterEach(() => {
  dispose?.();
  root.remove();
});

describe("sound library", () => {
  it("filters by category and searches in the page language and English", async () => {
    await show({ locale: "ar" });
    expect(rows()).toEqual(["voice-go", "alert-success", "alert-error"]);
    expect(root.textContent).toContain("«Go»: انطلق");

    (
      root.querySelector('[role="option"][data-value="alerts"]') as HTMLElement
    ).click();
    await vi.waitFor(() =>
      expect(rows()).toEqual(["alert-success", "alert-error"]),
    );

    type("sound-library-search", "نجاح");
    await vi.waitFor(() => expect(rows()).toEqual(["alert-success"]));
    type("sound-library-search", "error");
    await vi.waitFor(() => expect(rows()).toEqual(["alert-error"]));
    type("sound-library-search", "nothing at all");
    await vi.waitFor(() =>
      expect(root.querySelector("[data-library-empty]")).not.toBeNull(),
    );
  });

  it("plays one preview at a time, at the soundboard volume, only when asked", async () => {
    await show();
    expect(play).not.toHaveBeenCalled();
    volume = 0.25;
    (
      root.querySelector('[data-preview-sound="voice-go"]') as HTMLElement
    ).click();
    await vi.waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    expect(play).toHaveBeenCalledWith(
      "library:voice-go",
      "https://api/soundboard/library/voice-go/audio?v=abcdef012345",
      0.25,
    );
    (
      root.querySelector('[data-preview-sound="alert-error"]') as HTMLElement
    ).click();
    await vi.waitFor(() => expect(play).toHaveBeenCalledTimes(2));
    // the one before stops first
    expect(stopAll).toHaveBeenCalledTimes(2);
  });

  it("adds a sound under the name you give it, then shows it as added", async () => {
    const entry = await show({ locale: "de" });
    addLibrarySound.mockImplementation(async (_c, _s, id, data) => ({
      _id: "NEW",
      library_id: id,
      name: data.name,
    }));
    (
      root.querySelector('[data-add-library-sound="voice-go"]') as HTMLElement
    ).click();
    const field = root.querySelector(
      'input[name="library-sound-name"]',
    ) as HTMLInputElement;
    await vi.waitFor(() => expect(field?.value).toBe("„Go“: Los"));
    type("library-sound-name", "Los geht's");
    (
      root.querySelector(
        '[data-confirm-library-sound="voice-go"]',
      ) as HTMLElement
    ).click();
    await vi.waitFor(() =>
      expect(
        root.querySelector('[data-library-added="voice-go"]'),
      ).not.toBeNull(),
    );
    expect(addLibrarySound).toHaveBeenCalledWith(
      expect.anything(),
      { id: "SV" },
      "voice-go",
      {
        name: "Los geht's",
      },
    );
    expect(entry.sounds.get("NEW")).toMatchObject({ library_id: "voice-go" });
  });

  it("shows the error in the panel when adding fails", async () => {
    await show();
    addLibrarySound.mockRejectedValue({ type: "SoundAlreadyAdded" });
    (
      root.querySelector(
        '[data-add-library-sound="alert-error"]',
      ) as HTMLElement
    ).click();
    await vi.waitFor(() =>
      expect(
        root.querySelector('[data-confirm-library-sound="alert-error"]'),
      ).not.toBeNull(),
    );
    (
      root.querySelector(
        '[data-confirm-library-sound="alert-error"]',
      ) as HTMLElement
    ).click();
    await vi.waitFor(() =>
      expect(root.querySelector('[role="alert"]')?.textContent).toBe(
        "error:SoundAlreadyAdded",
      ),
    );
  });

  it("marks sounds the server has, and offers no Add without Manage Soundboard", async () => {
    await show({ entry: board([{ _id: "X", library_id: "alert-success" }]) });
    expect(
      root.querySelector('[data-library-added="alert-success"]'),
    ).not.toBeNull();
    expect(
      root.querySelector('[data-add-library-sound="alert-success"]'),
    ).toBeNull();
    dispose?.();
    root.replaceChildren();

    await show({ canAdd: false });
    expect(root.querySelector("[data-add-library-sound]")).toBeNull();
    // listening still works
    expect(
      root.querySelector('[data-preview-sound="voice-go"]'),
    ).not.toBeNull();
  });

  it("a full soundboard offers no Add", async () => {
    await show({ entry: board([{ _id: "A" }, { _id: "B" }], 2) });
    expect(
      (
        root.querySelector(
          '[data-add-library-sound="voice-go"]',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("shows a long list a page at a time", async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...library.sounds[1],
      id: `s-${i}`,
      names: { en: `Sound ${i}` },
    }));
    fetchSoundLibrary.mockResolvedValueOnce({
      ...library,
      sounds: many,
    } as never);
    await show();
    expect(rows()).toHaveLength(24);
    const more = [...root.querySelectorAll("button")].find(
      (b) => b.textContent === "Show more",
    )!;
    more.click();
    await vi.waitFor(() => expect(rows()).toHaveLength(30));
  });
});
