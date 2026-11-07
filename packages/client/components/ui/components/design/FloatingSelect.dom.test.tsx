/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles */
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "./Dialog";
import { FloatingSelect } from "./FloatingSelect";
import { MenuItem } from "./Menu";

// @solid-aria ships extensionless ESM imports that Node cannot load here
vi.mock("./Button", () => ({
  Button: (props: { children?: unknown; onPress?: () => void }) => (
    <button onClick={() => props.onPress?.()}>
      {props.children as string}
    </button>
  ),
}));

vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));

// the real MotionPresence, with the motion settings stubbed
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
  // jsdom has no layout engine for the floating positioner
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

const key = (el: Element, k: string, shiftKey = false) =>
  el.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: k,
      shiftKey,
      bubbles: true,
      cancelable: true,
    }),
  );
const tick = () => new Promise((r) => setTimeout(r, 30));

function Harness(props: { inDialog?: boolean; onClose?: () => void }) {
  const [value, setValue] = createSignal("b");
  const select = (
    <FloatingSelect
      aria-label="Pick"
      value={value()}
      onChange={(e) => setValue(e.currentTarget.value)}
    >
      <MenuItem value="a">Alpha</MenuItem>
      <MenuItem value="b">Beta</MenuItem>
      <MenuItem value="c">Gamma</MenuItem>
    </FloatingSelect>
  );
  return props.inDialog ? (
    <I18nProvider i18n={i18n}>
      <Dialog show title="T" onClose={() => props.onClose?.()}>
        <textarea aria-label="text" />
        {select}
      </Dialog>
    </I18nProvider>
  ) : (
    select
  );
}

const trigger = () =>
  document.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;
const items = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>('#floating [role="menuitem"]'),
  );

describe("FloatingSelect keyboard", () => {
  it("opens with ArrowDown on the selected item, moves, picks with Enter", async () => {
    dispose = render(() => <Harness />, document.getElementById("root")!);
    trigger().focus();
    key(trigger(), "ArrowDown");
    await tick();
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(items()[1]);

    key(document.activeElement!, "ArrowDown");
    expect(document.activeElement).toBe(items()[2]);
    key(document.activeElement!, "Home");
    expect(document.activeElement).toBe(items()[0]);
    key(document.activeElement!, "End");
    expect(document.activeElement).toBe(items()[2]);
    key(document.activeElement!, "ArrowUp");
    expect(document.activeElement).toBe(items()[1]);

    // Enter on a button is a click
    items()[0].focus();
    items()[0].click();
    await tick();
    expect(trigger().textContent).toContain("Alpha");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger());
  });

  it("Tab and Shift+Tab out of an open menu stay inside the dialog", async () => {
    for (const shift of [false, true]) {
      const onClose = vi.fn();
      dispose = render(
        () => <Harness inDialog onClose={onClose} />,
        document.getElementById("root")!,
      );
      await tick();
      trigger().focus();
      key(trigger(), "ArrowDown");
      await tick();
      expect(items().length).toBe(3);
      expect(document.activeElement).toBe(items()[1]);
      key(document.activeElement!, "Tab", shift);
      await tick();
      const dialog = document.querySelector('[role="dialog"]')!;
      expect(dialog.contains(document.activeElement)).toBe(true);
      expect(trigger().getAttribute("aria-expanded")).toBe("false");
      expect(onClose).not.toHaveBeenCalled();
      dispose();
      dispose = undefined;
      document.body.innerHTML =
        '<div id="floating"></div><div id="root"></div>';
    }
  });

  it("Escape closes only the menu, not the dialog around it", async () => {
    const onClose = vi.fn();
    dispose = render(
      () => <Harness inDialog onClose={onClose} />,
      document.getElementById("root")!,
    );
    await tick();
    trigger().focus();
    key(trigger(), "ArrowDown");
    await tick();
    expect(items().length).toBe(3);
    key(document.activeElement!, "Escape");
    await tick();
    expect(onClose).not.toHaveBeenCalled();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger());

    // with the menu closed, Escape reaches the dialog
    key(trigger(), "Escape");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("FloatingSelect exit", () => {
  it("closing in the same frame it opened leaves no menu behind", async () => {
    // a slow stand-in for the Web Animations API (jsdom has none)
    (Element.prototype as any).animate = function (_k: unknown, o: any) {
      let reversed = false;
      return {
        playState: "running",
        finished: new Promise<void>((r) => setTimeout(r, o.duration)),
        reverse() {
          reversed = !reversed;
        },
        cancel() {},
      };
    };
    dispose = render(() => <Harness />, document.getElementById("root")!);
    for (let i = 0; i < 3; i++) {
      // open and close before a frame has passed
      trigger().click();
      trigger().click();
    }
    await new Promise((r) => setTimeout(r, 600));
    expect(
      document.querySelectorAll("#floating [data-floating-menu]").length,
    ).toBe(0);
    // nothing at all is left in the layer, not even a hidden copy
    expect(document.getElementById("floating")!.innerHTML).toBe("<div></div>");
    delete (Element.prototype as any).animate;
  });
});

describe("closed Dialog", () => {
  it("leaves no layer that takes pointer events", () => {
    // the real generated CSS, so the variant rules are what is tested
    const out = join(mkdtempSync(join(tmpdir(), "panda-")), "styles.css");
    execFileSync(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      ["exec", "panda", "cssgen", "--outfile", out],
      { stdio: "ignore", shell: process.platform === "win32" },
    );
    const css = readFileSync(out, "utf8");
    dispose = render(
      () => (
        <I18nProvider i18n={i18n}>
          <Dialog show={false} title="T" onClose={() => undefined}>
            <span>body</span>
          </Dialog>
        </I18nProvider>
      ),
      document.getElementById("root")!,
    );
    const scrim = document.querySelector<HTMLElement>(".dialog_scrim")!;
    // jsdom cannot cascade `@layer` rules, so read the rules for the
    // classes the closed scrim carries
    const rules = (selector: string) =>
      [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .filter(([, sel]) => sel.trim() === selector)
        .map(([, , body]) => body)
        .join(";");
    const own = [...scrim.classList].map((c) => rules(`.${c}`)).join(";");
    const kids = [...scrim.classList].map((c) => rules(`.${c}>*`)).join(";");
    expect(own).toMatch(/pointer-events:none/);
    expect(kids).toMatch(/pointer-events:none/);
  }, 90000);
});
