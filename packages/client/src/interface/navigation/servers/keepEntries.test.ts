import { describe, expect, it } from "vitest";

import { keepEntries } from "./keepEntries";

type Entry = Parameters<typeof keepEntries>[1][number];

const a = { id: "a" } as never;
const b = { id: "b" } as never;
const folder = { id: "f", servers: ["a", "b"] } as never;

describe("keepEntries", () => {
  it("hands back the entries already drawn when nothing changed", () => {
    const first: Entry[] = [
      { type: "server", id: "a", server: a },
      { type: "folder", id: "f", folder, servers: [a, b] },
    ];
    const kept = keepEntries(undefined, first);

    // the store builds new objects every time it is read
    const again: Entry[] = [
      { type: "server", id: "a", server: a },
      { type: "folder", id: "f", folder, servers: [a, b] },
    ];
    const next = keepEntries(kept, again);

    expect(next[0]).toBe(kept[0]);
    expect(next[1]).toBe(kept[1]);
  });

  it("follows a new order without redrawing the entries", () => {
    const kept = keepEntries(undefined, [
      { type: "server", id: "a", server: a },
      { type: "server", id: "b", server: b },
    ]);
    const next = keepEntries(kept, [
      { type: "server", id: "b", server: b },
      { type: "server", id: "a", server: a },
    ]);
    expect(next[0]).toBe(kept[1]);
    expect(next[1]).toBe(kept[0]);
  });

  it("takes the new entry when what it shows changed", () => {
    const kept = keepEntries(undefined, [
      { type: "folder", id: "f", folder, servers: [a, b] },
    ]);
    const fewer: Entry = { type: "folder", id: "f", folder, servers: [a] };
    expect(keepEntries(kept, [fewer])[0]).toBe(fewer);

    const renamed: Entry = {
      type: "folder",
      id: "f",
      folder: { ...(folder as object) } as never,
      servers: [a, b],
    };
    expect(keepEntries(kept, [renamed])[0]).toBe(renamed);
  });
});
