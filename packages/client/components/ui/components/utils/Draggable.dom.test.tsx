import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Draggable } from "./Draggable";

vi.mock("@lingui/solid/macro", () => ({ useLingui: () => ({ t: String }) }));

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

type Row = { id: string; name: string };

function mount(initial: Row[]) {
  const [items, setItems] = createSignal(initial);
  const drawn: string[] = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(
    () => (
      <Draggable items={items()} onChange={() => undefined}>
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
});
