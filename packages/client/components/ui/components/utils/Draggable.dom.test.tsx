import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Draggable, createDragHandle } from "./Draggable";

vi.mock("@lingui/solid/macro", () => ({ useLingui: () => ({ t: String }) }));
// the macro is compiled to this hook; a message descriptor reads as its text
vi.mock("@lingui/solid", () => {
  const text = (d: unknown) =>
    typeof d === "string" ? d : ((d as { message?: string }).message ?? "");
  return { useLingui: () => ({ t: text, _: text, i18n: { _: text } }) };
});

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

type Row = { id: string; name: string };

function mount(
  initial: Row[],
  onChange: (ids: string[]) => void = () => undefined,
) {
  const [items, setItems] = createSignal(initial);
  const drawn: string[] = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(
    () => (
      <Draggable items={items()} onChange={onChange}>
        {({ item }) => {
          drawn.push(item.id);
          return <div data-row={item.id}>{item.name}</div>;
        }}
      </Draggable>
    ),
    host,
  );
  return { host, setItems, drawn };
}

describe("Draggable", () => {
  const a = { id: "a", name: "A" };
  const b = { id: "b", name: "B" };
  const c = { id: "c", name: "C" };

  it("keeps its rows when given a new list of the same items", async () => {
    const { host, setItems, drawn } = mount([a, b]);
    const row = host.querySelector('[data-row="a"]');
    drawn.length = 0;

    setItems([a, b]);
    await Promise.resolve();

    expect(drawn).toEqual([]);
    expect(host.querySelector('[data-row="a"]')).toBe(row);
  });

  it("draws only the rows that are new, in the new order", async () => {
    const { host, setItems, drawn } = mount([a, b]);
    const row = host.querySelector('[data-row="a"]');
    drawn.length = 0;

    setItems([c, a]);
    await Promise.resolve();

    expect(drawn).toEqual(["c"]);
    expect(host.querySelector('[data-row="a"]')).toBe(row);
    expect(
      [...host.querySelectorAll("[data-row]")].map((e) =>
        e.getAttribute("data-row"),
      ),
    ).toEqual(["c", "a"]);
  });

  it("redraws a row whose item was replaced", async () => {
    const { host, setItems } = mount([a]);

    setItems([{ id: "a", name: "A2" }]);
    await Promise.resolve();

    expect(host.querySelector('[data-row="a"]')?.textContent).toBe("A2");
  });

  it("reads no layout when a list opens or its items change (only a drag measures)", async () => {
    const reads = vi.spyOn(Element.prototype, "getBoundingClientRect");
    const { setItems } = mount([a, b, c]);
    await new Promise((r) => setTimeout(r, 10));
    setItems([c, a, b]);
    await new Promise((r) => setTimeout(r, 10));
    expect(reads).not.toHaveBeenCalled();
    reads.mockRestore();
  });

  it("still reorders with the keyboard", async () => {
    const changes: string[][] = [];
    const { host } = mount([a, b, c], (ids) => changes.push(ids));
    await new Promise((r) => setTimeout(r, 10));
    const zone = host.querySelector("[data-drop-zone]") as HTMLElement;
    expect(zone.getAttribute("role")).toBe("list");
    const first = zone.children[0] as HTMLElement;
    expect(first.getAttribute("role")).toBe("listitem");
    expect(first.tabIndex).toBe(0);

    const key = (el: Element, k: string) =>
      el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
    first.focus();
    key(first, " ");
    await new Promise((r) => setTimeout(r, 10));
    key(zone.children[0], "ArrowDown");
    await new Promise((r) => setTimeout(r, 10));
    key(
      zone.querySelector('[data-row="a"]')!.parentElement ?? zone.children[1],
      " ",
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(changes.at(-1)).toEqual(["b", "a", "c"]);
  });

  it("gives a handle drawn as a plain icon the button role, so its name is read", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    dispose = render(() => {
      const [disabled, setDisabled] = createSignal(true);
      return (
        <span
          {...createDragHandle(disabled, setDisabled)}
          aria-label="Drag to reorder Mods"
        >
          ::
        </span>
      );
    }, host);
    const handle = host.querySelector("span")!;
    expect(handle.getAttribute("role")).toBe("button");
    expect(handle.getAttribute("tabindex")).toBe("0");
    expect(handle.getAttribute("aria-label")).toBe("Drag to reorder Mods");
  });
});
