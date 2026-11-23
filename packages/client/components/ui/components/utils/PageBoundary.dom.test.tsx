import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { type JSX, createSignal, ErrorBoundary } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";

import { lazy } from "@revolt/common/lib/lazyPart";

vi.mock("../design/Button", () => ({
  Button: (props: { children?: unknown; onPress?: () => void }) => (
    <button type="button" onClick={() => props.onPress?.()}>
      {props.children as never}
    </button>
  ),
}));

import { PageBoundary } from "./PageBoundary";

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const NOTE = "Could not open.";
const HINT = "Check your connection and try again.";

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

/** A page whose download fails `failures` times, then works */
function flakyPage(failures: number) {
  let calls = 0;
  const load = vi.fn(() =>
    ++calls <= failures
      ? Promise.reject(
          new TypeError("Failed to fetch dynamically imported module"),
        )
      : Promise.resolve({
          default: () => <main data-testid="page">Discover</main>,
        }),
  );
  return { load, Page: lazy(load) };
}

function mount(children: () => JSX.Element, resetKey?: () => unknown) {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  const root = document.createElement("div");
  document.body.append(root);
  const seen: unknown[] = [];
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <ErrorBoundary
          fallback={(error) => {
            seen.push(error);
            return <b data-testid="outer" />;
          }}
        >
          <PageBoundary resetKey={resetKey}>{children()}</PageBoundary>
        </ErrorBoundary>
      </I18nProvider>
    ),
    root,
  );
  return seen;
}

const note = () =>
  [...document.querySelectorAll('[role="alert"]')].find((el) =>
    el.textContent?.includes(NOTE),
  );
const tryAgain = () =>
  [...document.querySelectorAll("button")].find(
    (b) => b.textContent === "Try again",
  );

describe("a page that could not be downloaded", () => {
  it("shows a note with Try again, and Try again asks for the page again", async () => {
    const { load, Page } = flakyPage(1);
    mount(() => <Page />);
    await tick();
    expect(note()).toBeDefined();
    // the app's empty state: its mood, a title and one line
    expect(note()!.querySelector("[data-empty-state]")).not.toBeNull();
    expect(note()!.querySelector('[data-mood="alert"]')).not.toBeNull();
    expect(note()!.textContent).toContain(HINT);
    expect(document.querySelector('[data-testid="page"]')).toBeNull();

    tryAgain()!.click();
    await tick();
    expect(document.querySelector('[data-testid="page"]')?.textContent).toBe(
      "Discover",
    );
    expect(note()).toBeUndefined();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("a page that loaded and then breaks is not hidden: the error goes up", async () => {
    const Broken = (): JSX.Element => {
      throw new RangeError("a bug in the page");
    };
    const seen = mount(() => <Broken />);
    await tick();
    expect(note()).toBeUndefined();
    expect(seen[0]).toBeInstanceOf(RangeError);
  });

  it("leaving for another page clears the note", async () => {
    const { Page } = flakyPage(5);
    const [path, setPath] = createSignal("/discover");
    const Other = () => <main data-testid="other">Home</main>;
    mount(() => (path() === "/discover" ? <Page /> : <Other />), path);
    await tick();
    expect(note()).toBeDefined();
    setPath("/app");
    await tick();
    expect(note()).toBeUndefined();
    expect(document.querySelector('[data-testid="other"]')).not.toBeNull();
  });
});
