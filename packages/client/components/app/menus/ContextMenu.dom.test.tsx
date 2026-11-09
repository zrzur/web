/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles */
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerFloatingElement } from "@revolt/ui/directives/floating";

import { FloatingManager } from "../../ui/components/floating/FloatingManager";

import {
  ContextMenu,
  ContextMenuButton,
  ContextMenuSubMenu,
} from "./ContextMenu";

// the menu's own parts only: the design-system barrel pulls in the whole app
vi.mock("@revolt/ui", () => ({
  iconSize: () => ({}),
  symbolSize: () => ({}),
  Text: (props: any) => <span>{props.children}</span>,
}));
vi.mock("@revolt/ui/icons/Icon", () => ({
  Icon: () => <i aria-hidden="true" />,
}));
vi.mock("../../ui/components/design", () => ({
  typography: { raw: () => ({}) },
}));
vi.mock("../../ui/components/floating/UserCard", () => ({
  UserCard: () => null,
}));
vi.mock("../../ui/components/floating/AutoComplete", () => ({
  AutoComplete: () => null,
}));
vi.mock("@revolt/keybinds", () => ({
  Keybind: () => null,
  KeybindAction: { CLOSE_FLOATING: "close" },
}));
vi.mock("@revolt/state", () => ({
  useState: () => ({ motion: { resolve: () => undefined } }),
}));
vi.mock("@revolt/ui/motion", async () => {
  const { Show } = await import("solid-js");
  return {
    useMotion: () => ({ play: () => Promise.resolve(), duration: () => 0 }),
    MotionPresence: (props: any) => (
      <Show when={props.when}>
        {typeof props.children === "function"
          ? props.children(() => props.when)
          : props.children}
      </Show>
    ),
  };
});

let dispose: (() => void) | undefined;
const tick = () => new Promise((r) => setTimeout(r, 30));

/** Pretend the window is a phone (or not) */
function setPhone(phone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: phone && query.includes("max-width: 600px"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  })) as never;
}

beforeEach(() => {
  document.body.innerHTML = '<div id="floating"></div><div id="root"></div>';
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

/** A server-style menu with a Notifications submenu, opened by the manager */
async function openMenu() {
  const anchor = document.createElement("a");
  document.getElementById("root")!.append(anchor);
  const [show, setShow] = createSignal<any>({
    contextMenu: () => (
      <ContextMenu>
        <ContextMenuButton>Server info</ContextMenuButton>
        <ContextMenuSubMenu buttonContent="Notifications">
          <ContextMenuButton data-testid="inner">
            All messages
          </ContextMenuButton>
        </ContextMenuSubMenu>
      </ContextMenu>
    ),
  });
  const hide = vi.fn(() => setShow(undefined));
  registerFloatingElement({
    config: () => ({ contextMenu: () => null }) as never,
    element: anchor,
    hide,
    show,
  });
  dispose = render(() => <FloatingManager />, document.body);
  await tick();
  const trigger = [...document.querySelectorAll("[role='menuitem']")].find(
    (el) => el.textContent?.includes("Notifications"),
  ) as HTMLElement;
  return { trigger, hide, show };
}

/** A real tap: pointer down, then the click the browser sends */
function tap(el: HTMLElement) {
  // jsdom has no PointerEvent; the handlers only read the type
  el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("submenus in the phone sheet", () => {
  it("a tap opens the submenu inside the sheet and keeps the sheet open", async () => {
    setPhone(true);
    const { trigger, hide, show } = await openMenu();
    expect(trigger).toBeTruthy();

    tap(trigger);
    await tick();

    expect(hide).not.toHaveBeenCalled();
    expect(show()).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const inner = document.querySelector("[data-testid='inner']");
    expect(inner).toBeTruthy();
    // in place: the entries sit in the same menu as the trigger
    expect(trigger.closest("[role='menu']")!.contains(inner)).toBe(true);

    // a second tap folds it again, still without closing the sheet
    tap(trigger);
    await tick();
    expect(hide).not.toHaveBeenCalled();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector("[data-testid='inner']")).toBeNull();
  });

  it("an entry of the opened submenu still closes the sheet when chosen", async () => {
    setPhone(true);
    const { trigger, hide } = await openMenu();
    tap(trigger);
    await tick();
    tap(document.querySelector("[data-testid='inner']") as HTMLElement);
    await tick();
    expect(hide).toHaveBeenCalled();
  });
});

describe("submenus on desktop", () => {
  it("still float beside the menu (not in place)", async () => {
    setPhone(false);
    const { trigger, hide } = await openMenu();
    trigger.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    await tick();
    const inner = document.querySelector("[data-testid='inner']");
    expect(inner).toBeTruthy();
    expect(trigger.closest("[role='menu']")!.contains(inner)).toBe(false);
    expect(hide).not.toHaveBeenCalled();
  });
});
