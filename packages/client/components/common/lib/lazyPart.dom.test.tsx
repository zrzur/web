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

  it("asks the app to reload once the second try fails too", async () => {
    online(true);
    const { Part } = flakyPart(5);
    await Part.preload().catch(() => undefined);
    expect(repeated).not.toHaveBeenCalled();
    await Part.preload().catch(() => undefined);
    expect(repeated).toHaveBeenCalledTimes(1);
  });

  it("counts the quiet second try of retryMs as the second try", async () => {
    online(true);
    const { Part } = flakyPart(5, 1);
    await Part.preload().catch(() => undefined);
    expect(repeated).toHaveBeenCalledTimes(1);
  });

  it("does nothing while the device is offline", async () => {
    online(false);
    const { Part } = flakyPart(5);
    await Part.preload().catch(() => undefined);
    await Part.preload().catch(() => undefined);
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
    const Part = lazy(load);
    await Part.preload().catch(() => undefined);
    await Part.preload();
    expect(repeated).not.toHaveBeenCalled();
  });
});
