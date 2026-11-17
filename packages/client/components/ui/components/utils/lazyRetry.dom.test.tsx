import { Show, Suspense, createResource, createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";

import { lazyRetry } from "./lazyRetry";

const tick = (ms = 0) => new Promise((done) => setTimeout(done, ms));

describe("lazyRetry keeps its wait to itself", () => {
  let dispose: (() => void) | undefined;
  afterEach(() => {
    dispose?.();
    dispose = undefined;
    document.body.innerHTML = "";
  });

  /** An app with its own loading screen, and a part that opens on demand */
  function mount(Part: () => unknown) {
    const [open, setOpen] = createSignal(false);
    const host = document.createElement("div");
    document.body.append(host);
    dispose = render(
      () => (
        <Suspense fallback={<p data-first-screen>loading the app</p>}>
          <main data-app>the app</main>
          <Show when={open()}>{Part() as never}</Show>
        </Suspense>
      ),
      host,
    );
    return { host, setOpen };
  }

  it("the app stays on screen while the part's file loads", async () => {
    let arrive!: (part: { default: () => unknown }) => void;
    const Part = lazyRetry(
      () => new Promise<{ default: () => unknown }>((done) => (arrive = done)),
      () => null,
    );
    const { host, setOpen } = mount(() => <Part />);

    setOpen(true);
    await tick();
    expect(host.querySelector("[data-app]")).not.toBeNull();
    expect(host.querySelector("[data-first-screen]")).toBeNull();

    arrive({ default: () => <aside data-part>sounds</aside> });
    await tick(5);
    expect(host.querySelector("[data-part]")).not.toBeNull();
    expect(host.querySelector("[data-app]")).not.toBeNull();
  });

  it("the app stays on screen while the part waits for data it reads", async () => {
    let answer!: (list: string[]) => void;
    const Inner = () => {
      const [list] = createResource(
        () => new Promise<string[]>((done) => (answer = done)),
      );
      // reading it while it is on its way is what hands the wait upward
      return <aside data-part>{list()?.join(",")}</aside>;
    };
    const Part = lazyRetry(
      async () => ({ default: Inner }),
      () => null,
    );
    const { host, setOpen } = mount(() => <Part />);

    setOpen(true);
    await tick(5);
    expect(host.querySelector("[data-app]")).not.toBeNull();
    expect(host.querySelector("[data-first-screen]")).toBeNull();

    answer(["airhorn"]);
    await tick(5);
    expect(host.querySelector("[data-part]")?.textContent).toBe("airhorn");
    expect(host.querySelector("[data-app]")).not.toBeNull();
  });

  it("passes its props on", async () => {
    const Part = lazyRetry(
      async () => ({
        default: (props: { name: string }) => (
          <aside data-part>{props.name}</aside>
        ),
      }),
      () => null,
    );
    const { host, setOpen } = mount(() => <Part name="lounge" />);
    setOpen(true);
    await tick(5);
    expect(host.querySelector("[data-part]")?.textContent).toBe("lounge");
  });
});
