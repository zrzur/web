import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { ReactiveMap } from "@solid-primitives/map";
import { JSX, splitProps } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The server's sounds are the ones its people upload: no ready-made
// library, no tabs (owner, 2026-11-27).

vi.mock("@revolt/rtc/voiceExtrasStore", () => ({
  SoundboardPlayer: class {
    play = vi.fn();
    stopAll = vi.fn();
  },
  createSound: vi.fn(),
  deleteSound: vi.fn(),
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
  };
});

import { SoundboardList } from "./SoundboardList";

let dispose: (() => void) | undefined;
let root: HTMLDivElement;

beforeEach(() => {
  root = document.createElement("div");
  document.body.append(root);
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
  it("only uploads: no library and no tabs", () => {
    show();
    expect(root.querySelector('[role="radiogroup"]')).toBeNull();
    expect(root.textContent).not.toContain("Library");
    expect(root.querySelector('input[type="file"]')).not.toBeNull();
  });
});
