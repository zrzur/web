import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DateTimeField } from "./DateTimeField";

vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));
vi.mock("@revolt/state", () => ({
  useState: () => ({
    motion: {
      resolve: () => ({
        style: "fade",
        duration: 120,
        easing: "ease",
        direction: "up",
        origin: "center",
      }),
    },
  }),
}));

let dispose: (() => void) | undefined;

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  window.matchMedia ??= (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as never;
  document.body.innerHTML = '<div id="floating"></div><div id="root"></div>';
  document.dir = "ltr";
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
});

function mount(start: Date, min?: Date) {
  const [value, setValue] = createSignal<Date | undefined>(start);
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <DateTimeField
          label="Starts"
          value={value()}
          min={min}
          hour12={false}
          testId="field"
          onChange={setValue}
        />
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );
  const toggle = document.querySelector<HTMLButtonElement>(
    "[data-testid=field-date]",
  )!;
  return { value, toggle };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const key = (target: Element, name: string) =>
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key: name, bubbles: true }),
  );

describe("DateTimeField", () => {
  it("opens a month grid and picks a day with the keyboard, keeping the time", async () => {
    const { value, toggle } = mount(new Date(2026, 11, 10, 18, 30));
    expect(toggle.textContent).toMatch(/10/);
    toggle.click();
    await flush();
    const grid = document.querySelector("[role=grid]")!;
    expect(grid).toBeTruthy();
    expect(document.activeElement?.getAttribute("data-day")).toBe(
      new Date(2026, 11, 10).toDateString(),
    );
    key(document.activeElement!, "ArrowRight");
    await flush();
    key(document.activeElement!, "ArrowDown");
    await flush();
    (document.activeElement as HTMLButtonElement).click();
    await flush();
    expect(value()!.getDate()).toBe(18);
    expect([value()!.getHours(), value()!.getMinutes()]).toEqual([18, 30]);
    // chosen: the calendar closes and focus goes back to the field
    expect(document.querySelector("[role=grid]")).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  it("follows the reading direction for left and right in Arabic layouts", async () => {
    document.dir = "rtl";
    const { toggle } = mount(new Date(2026, 11, 10, 9, 0));
    toggle.click();
    await flush();
    key(document.activeElement!, "ArrowLeft");
    await flush();
    expect(document.activeElement?.getAttribute("data-day")).toBe(
      new Date(2026, 11, 11).toDateString(),
    );
  });

  it("does not offer days before the earliest one and closes with Escape", async () => {
    const { value, toggle } = mount(
      new Date(2026, 11, 10, 9, 0),
      new Date(2026, 11, 10, 8, 0),
    );
    toggle.click();
    await flush();
    const before = document.querySelector<HTMLButtonElement>(
      `[data-day="${new Date(2026, 11, 9).toDateString()}"]`,
    )!;
    expect(before.disabled).toBe(true);
    before.click();
    expect(value()!.getDate()).toBe(10);
    key(document.activeElement!, "Escape");
    await flush();
    expect(document.querySelector("[role=grid]")).toBeNull();
  });
});
