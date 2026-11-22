import {
  type JSX,
  ErrorBoundary,
  Show,
  Suspense,
  createSignal,
} from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";

import { lazy } from "./lazyPart";

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

/** A part of the app whose download fails `failures` times, then works */
function flakyPart(failures: number, retryMs?: number) {
  let calls = 0;
  const load = vi.fn(() => {
    calls++;
    return calls <= failures
      ? Promise.reject(
          new TypeError("Failed to fetch dynamically imported module"),
        )
      : Promise.resolve({
          default: (props: { name: string }) => (
            <p data-testid="part">{props.name}</p>
          ),
        });
  });
  return { load, Part: lazy(load, retryMs) };
}

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

/** Mount the part behind a switch, as a dialog is mounted by its button */
function mountBehindSwitch(Part: (props: { name: string }) => JSX.Element) {
  const [open, setOpen] = createSignal(false);
  const root = document.createElement("div");
  document.body.append(root);
  dispose = render(
    () => (
      <Show when={open()}>
        <ErrorBoundary fallback={<span data-testid="failed" />}>
          <Suspense>
            <Part name="Add friend" />
          </Suspense>
        </ErrorBoundary>
      </Show>
    ),
    root,
  );
  return setOpen;
}

describe("lazy parts of the app (phones: dead buttons after a lost download)", () => {
  it("a download that failed once is asked for again the next time the part opens", async () => {
    // the first try fails (no connection for a moment), then it works
    const { load, Part } = flakyPart(1);
    const setOpen = mountBehindSwitch(Part);

    setOpen(true);
    await tick();
    expect(document.querySelector('[data-testid="failed"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="part"]')).toBeNull();

    // the button is pressed again once the connection is back
    setOpen(false);
    await tick();
    setOpen(true);
    await tick();

    expect(document.querySelector('[data-testid="part"]')?.textContent).toBe(
      "Add friend",
    );
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("it does not try again by itself (no dialog turning up late)", async () => {
    const { load, Part } = flakyPart(1);
    const setOpen = mountBehindSwitch(Part);
    setOpen(true);
    await tick(300);
    expect(document.querySelector('[data-testid="part"]')).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("with retryMs, one lost request is tried again without a second press", async () => {
    const { Part } = flakyPart(1, 10);
    const setOpen = mountBehindSwitch(Part);
    setOpen(true);
    await tick(100);
    expect(document.querySelector('[data-testid="part"]')?.textContent).toBe(
      "Add friend",
    );
  });

  it("a part that loaded is not downloaded again", async () => {
    const { load, Part } = flakyPart(0);
    const setOpen = mountBehindSwitch(Part);
    setOpen(true);
    await tick();
    setOpen(false);
    await tick();
    setOpen(true);
    await tick();
    expect(document.querySelector('[data-testid="part"]')).not.toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("preload that failed does not stop the part from opening later", async () => {
    const { load, Part } = flakyPart(1);
    await (Part as unknown as { preload: () => Promise<unknown> })
      .preload()
      .catch(() => undefined);
    const setOpen = mountBehindSwitch(Part);
    setOpen(true);
    await tick();
    expect(document.querySelector('[data-testid="part"]')).not.toBeNull();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
