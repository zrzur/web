import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { For } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Owner, 2026-11-24: starting a call in a DM or group asks first, with a
// title, one line, Start call and Cancel. Only Start call rings anyone.

type Action = { text: unknown; variant?: string; onClick?: () => unknown };

vi.mock("@revolt/ui", () => ({
  Dialog: (props: {
    title?: unknown;
    children?: unknown;
    actions?: Action[];
    onClose: () => void;
  }) => (
    <div data-dialog>
      <h2>{props.title as never}</h2>
      {props.children as never}
      <For each={props.actions}>
        {(action) => (
          <button
            data-action={action.variant ?? "secondary"}
            onClick={() => {
              if (action.onClick?.() !== false) props.onClose();
            }}
          >
            {action.text as never}
          </button>
        )}
      </For>
    </div>
  ),
}));

import { StartCallModal } from "./StartCall";

let dispose: (() => void) | undefined;
const onStart = vi.fn();
const onClose = vi.fn();

function open(channel: object, video = false) {
  document.body.innerHTML = "<div></div>";
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <StartCallModal
          {...({
            type: "start_call",
            channel,
            video,
            onStart,
            show: true,
            onClose,
          } as unknown as Parameters<typeof StartCallModal>[0])}
        />
      </I18nProvider>
    ),
    document.body.firstElementChild as HTMLElement,
  );
}

const dm = {
  type: "DirectMessage",
  recipient: { displayName: "Sara", username: "sara" },
};
const group = { type: "Group", name: "Weekend trip" };

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  onStart.mockClear();
  onClose.mockClear();
});
afterEach(() => dispose?.());

describe("asking before a call rings anyone", () => {
  it("names the person and starts only on Start a call", () => {
    open(dm);
    // the title is the call's name; one line under it
    expect(document.querySelector("h2")!.textContent).toBe("Sara");
    expect(
      document.querySelector("[data-start-call-confirm]")!.textContent,
    ).toBe("No one is here yet. Start the call and others can join.");
    const start = document.querySelector<HTMLButtonElement>(
      "[data-action='primary']",
    )!;
    expect(start.textContent).toBe("Start a call");
    start.click();
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it("Cancel closes without ringing", () => {
    open(dm);
    document
      .querySelector<HTMLButtonElement>("[data-action='secondary']")!
      .click();
    expect(onStart).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("names the group, and says video for a video call", () => {
    open(group, true);
    expect(document.querySelector("h2")!.textContent).toBe("Weekend trip");
    expect(
      document.querySelector<HTMLButtonElement>("[data-action='primary']")!
        .textContent,
    ).toBe("Start a video call");
    expect(
      document
        .querySelector("[data-start-call-confirm]")!
        .getAttribute("data-start-call-confirm"),
    ).toBe("video");
  });
});
