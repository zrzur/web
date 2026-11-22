import {
  type JSX,
  ErrorBoundary,
  Show,
  Suspense,
  createSignal,
} from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PartLoadError, lazy, onRepeatedPartFailure } from "./lazyPart";

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

type Props = { name: string };
const Loaded = (props: Props) => <p data-testid="part">{props.name}</p>;
const lost = () => new TypeError("Failed to fetch dynamically imported module");

/** A part of the app whose download fails `failures` times, then works */
function flakyPart(failures: number, retryMs?: number) {
  let calls = 0;
  const load = vi.fn(() => {
    calls++;
    return calls <= failures
      ? Promise.reject(lost())
      : Promise.resolve({ default: Loaded });
  });
  return { load, Part: lazy(load, retryMs) };
}

const part = () => document.querySelector('[data-testid="part"]');
const failed = () => document.querySelector('[data-testid="failed"]');

let disposers: (() => void)[] = [];
let caught: unknown[] = [];
let repeated: ReturnType<typeof vi.fn<() => void>>;
let stopWatching: () => void;
beforeEach(() => {
  caught = [];
  repeated = vi.fn<() => void>();
  stopWatching = onRepeatedPartFailure(repeated);
});
afterEach(() => {
  stopWatching();
  for (const dispose of disposers) dispose();
  disposers = [];
  document.body.replaceChildren();
});

/** Mount the part behind a switch, as a dialog is mounted by its button */
function mountBehindSwitch(Part: (props: Props) => JSX.Element) {
  const [open, setOpen] = createSignal(false);
  const root = document.createElement("div");
  document.body.append(root);
  disposers.push(
    render(
      () => (
        <Show when={open()}>
          <ErrorBoundary
            fallback={(error) => {
              caught.push(error);
              return <span data-testid="failed" />;
            }}
          >
            <Suspense>
              <Part name="Add friend" />
            </Suspense>
          </ErrorBoundary>
        </Show>
      ),
      root,
    ),
  );
  return setOpen;
}

describe("lazy parts of the app (phones: dead buttons after a lost download)", () => {
  it("a download that failed once is asked for again the next time the part opens", async () => {
    const { load, Part } = flakyPart(1);
    const setOpen = mountBehindSwitch(Part);

    setOpen(true);
    await tick();
    expect(failed()).not.toBeNull();

    // the button is pressed again once the connection is back
    setOpen(false);
    await tick();
    setOpen(true);
    await tick();

    expect(part()?.textContent).toBe("Add friend");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("a failed download reaches the boundary as a PartLoadError, with the cause", async () => {
    const { Part } = flakyPart(1);
    mountBehindSwitch(Part)(true);
    await tick();
    expect(caught).toHaveLength(1);
    expect(caught[0]).toBeInstanceOf(PartLoadError);
    expect((caught[0] as PartLoadError).cause).toBeInstanceOf(TypeError);
  });

  it("two copies open while the download is under way: it fails for both, and a reopen works", async () => {
    let fail!: (error: unknown) => void;
    let calls = 0;
    const load = vi.fn(() =>
      ++calls === 1
        ? new Promise<{ default: typeof Loaded }>(
            (_, reject) => (fail = reject),
          )
        : Promise.resolve({ default: Loaded }),
    );
    const Part = lazy(load);
    const first = mountBehindSwitch(Part);
    const second = mountBehindSwitch(Part);
    first(true);
    second(true);
    await tick();
    expect(load).toHaveBeenCalledTimes(1);

    fail(lost());
    await tick();
    expect(document.querySelectorAll('[data-testid="failed"]')).toHaveLength(2);

    first(false);
    await tick();
    first(true);
    await tick();
    expect(part()?.textContent).toBe("Add friend");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("it does not try again by itself (no dialog turning up late)", async () => {
    const { load, Part } = flakyPart(1);
    mountBehindSwitch(Part)(true);
    await tick(300);
    expect(part()).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("with retryMs, one lost request is tried again without a second press", async () => {
    const { load, Part } = flakyPart(1, 10);
    mountBehindSwitch(Part)(true);
    await tick(100);
    expect(part()?.textContent).toBe("Add friend");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("a part that loaded is not downloaded again", async () => {
    const { load, Part } = flakyPart(0);
    const setOpen = mountBehindSwitch(Part);
    setOpen(true);
    await tick();
    setOpen(false);
    await tick();
    setOpen(true);
    expect(part()).not.toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("after a preload the part draws at once (no empty first frame) and is not downloaded again", async () => {
    const { load, Part } = flakyPart(0);
    await Part.preload();
    await Part.preload();
    const setOpen = mountBehindSwitch(Part);
    setOpen(true);
    // no tick: drawn in the same pass
    expect(part()?.textContent).toBe("Add friend");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("preload that failed does not stop the part from opening later", async () => {
    const { load, Part } = flakyPart(1);
    await Part.preload().catch(() => undefined);
    const setOpen = mountBehindSwitch(Part);
    setOpen(true);
    await tick();
    expect(part()).not.toBeNull();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("a preload nobody waits for leaves no unhandled rejection", async () => {
    const unhandled: unknown[] = [];
    const note = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", note);
    try {
      const { Part } = flakyPart(1);
      // as the router does: called, the promise dropped
      void Part.preload();
      await tick(50);
    } finally {
      process.off("unhandledRejection", note);
    }
    expect(unhandled).toEqual([]);
  });
});

describe("the same part failing twice in a row while online (Safari keeps failed modules)", () => {
  const online = (value: boolean) =>
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
  afterEach(() => vi.restoreAllMocks());

  /** open the part (a press), then close it again */
  async function press(setOpen: (open: boolean) => void, ms = 20) {
    setOpen(true);
    await tick(ms);
    setOpen(false);
    await tick();
  }

  it("asks the app to reload when the second press fails too", async () => {
    online(true);
    const { Part } = flakyPart(5);
    const setOpen = mountBehindSwitch(Part);
    await press(setOpen);
    expect(repeated).not.toHaveBeenCalled();
    await press(setOpen);
    expect(repeated).toHaveBeenCalledTimes(1);
  });

  it("does not count preloads (hover, focus, a finger landing on a link)", async () => {
    online(true);
    const { load, Part } = flakyPart(5);
    for (let i = 0; i < 4; i++) await Part.preload().catch(() => undefined);
    expect(load).toHaveBeenCalledTimes(4);
    expect(repeated).not.toHaveBeenCalled();
    // one real press after them is still only the first
    await press(mountBehindSwitch(Part));
    expect(repeated).not.toHaveBeenCalled();
  });

  it("counts a part's quiet second try (retryMs) with its first: one press is one failure", async () => {
    online(true);
    const { load, Part } = flakyPart(5, 1);
    const setOpen = mountBehindSwitch(Part);
    await press(setOpen, 50);
    expect(load).toHaveBeenCalledTimes(2);
    expect(repeated).not.toHaveBeenCalled();
    await press(setOpen, 50);
    expect(repeated).toHaveBeenCalledTimes(1);
  });

  it("a bug in the part's code is passed on as it is, and never counts", async () => {
    online(true);
    const bug = new ReferenceError("thing is not defined");
    const load = vi.fn(() => Promise.reject(bug));
    const setOpen = mountBehindSwitch(lazy(load));
    await press(setOpen);
    await press(setOpen);
    expect(caught).toEqual([bug, bug]);
    expect(caught[0]).not.toBeInstanceOf(PartLoadError);
    expect(repeated).not.toHaveBeenCalled();
  });

  it("a TypeError that is not a lost download is a bug too", async () => {
    online(true);
    const bug = new TypeError("Cannot read properties of undefined");
    const setOpen = mountBehindSwitch(lazy(() => Promise.reject(bug)));
    await press(setOpen);
    expect(caught[0]).toBe(bug);
  });

  it("does nothing while the device is offline", async () => {
    online(false);
    const { Part } = flakyPart(5);
    const setOpen = mountBehindSwitch(Part);
    await press(setOpen);
    await press(setOpen);
    expect(repeated).not.toHaveBeenCalled();
  });

  it("starts counting again after a success", async () => {
    online(true);
    let calls = 0;
    const load = vi.fn(() =>
      [1, 3].includes(++calls)
        ? Promise.reject(lost())
        : Promise.resolve({ default: Loaded }),
    );
    const setOpen = mountBehindSwitch(lazy(load));
    await press(setOpen);
    await press(setOpen);
    expect(repeated).not.toHaveBeenCalled();
  });
});
