import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { For, createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@revolt/ui", () => ({
  Button: (props: {
    children?: unknown;
    onPress?: () => void;
    isDisabled?: boolean;
  }) => (
    <button disabled={props.isDisabled} onClick={() => props.onPress?.()}>
      {props.children as never}
    </button>
  ),
}));
vi.mock("@revolt/ui/components/design/FlockDots", () => ({
  FlockDots: () => <span data-dots />,
}));

import { ShowMore, usePaged } from "./ShowMore";
import { PAGE_TILES } from "./gallery";

const names = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => `design ${from + i}`);

/** a list like the wall: 30 loaded, the server holds 30 more */
const [loaded, setLoaded] = createSignal<string[]>([]);
const [more, setMore] = createSignal(true);
const [loading, setLoading] = createSignal(false);
const server = { asked: 0 };
let resolveNext: (() => void) | undefined;
function fetchNext() {
  server.asked++;
  setLoading(true);
  resolveNext = () => {
    setLoaded((list) => [...list, ...names(list.length, 30)]);
    setMore(false);
    setLoading(false);
  };
}

function List() {
  const paged = usePaged(() => loaded(), {
    key: (name) => name,
    more: () => more(),
    loading: () => loading(),
    onMore: fetchNext,
  });
  return (
    <>
      <ul>
        <For each={paged.shown()}>{(name) => <li>{name}</li>}</For>
      </ul>
      <ShowMore state={paged.state()} onMore={paged.next} />
    </>
  );
}

let dispose: (() => void) | undefined;
beforeEach(() => {
  setLoaded(names(0, 30));
  setMore(true);
  setLoading(false);
  server.asked = 0;
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.innerHTML = '<div id="root"></div>';
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <List />
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );
});
afterEach(() => dispose?.());

const items = () =>
  [...document.querySelectorAll("li")].map((li) => li.textContent);
const button = () =>
  document.querySelector<HTMLButtonElement>("[data-show-more] button");

it("shows one page first, with a Show more button under it", () => {
  expect(items()).toHaveLength(PAGE_TILES);
  expect(button()?.textContent).toContain("Show more");
  expect(button()?.disabled).toBe(false);
});

it("appends the next page below the first one and fetches ahead", () => {
  button()!.click();
  // the 6 loaded but hidden, then the server's next page is asked for
  expect(items()).toHaveLength(30);
  expect(items().slice(0, PAGE_TILES)).toEqual(names(0, PAGE_TILES));
  expect(server.asked).toBe(1);
  // while it is on its way the button waits and asks nothing twice
  expect(
    document.querySelector("[data-show-more]")?.getAttribute("aria-busy"),
  ).toBe("true");
  expect(button()?.disabled).toBe(true);
  button()!.click();
  expect(server.asked).toBe(1);
  // it arrives: the page that was asked for fills in under the rest
  resolveNext!();
  expect(items()).toHaveLength(2 * PAGE_TILES);
  expect(items()[30]).toBe("design 30");
});

it("ends with a plain line once everything is shown", () => {
  button()!.click();
  resolveNext!();
  button()!.click();
  expect(items()).toHaveLength(60);
  expect(button()).toBeNull();
  expect(document.querySelector('[role="status"]')?.textContent).toContain(
    "That's everything",
  );
});

it("starts again from one page when the list is replaced", () => {
  button()!.click();
  setLoaded(names(100, 40));
  expect(items()).toHaveLength(PAGE_TILES);
  expect(items()[0]).toBe("design 100");
});
