import { describe, expect, it, test } from "vitest";

import {
  applyChannelOrdering,
  categoriesToSave,
  moveCategories,
  moveChannel,
  orderedCategories,
} from "./ordering";

describe("orderedCategories", () => {
  const category = (id: string, channels: string[]) => ({
    id,
    title: id,
    channels,
  });

  test("keeps stored channels, including the ones we cannot see", () => {
    expect(
      orderedCategories([category("news", ["a", "hidden"])], ["a"]),
    ).toEqual([
      { id: "default", title: "Default", channelIds: [] },
      { id: "news", title: "news", channelIds: ["a", "hidden"] },
    ]);
  });

  test("collects channels no category claims into default", () => {
    expect(
      orderedCategories([category("news", ["a"])], ["a", "b", "c"]),
    ).toEqual([
      { id: "default", title: "Default", channelIds: ["b", "c"] },
      { id: "news", title: "news", channelIds: ["a"] },
    ]);
  });

  test("appends unclaimed channels to a stored default, keeping its place", () => {
    expect(
      orderedCategories(
        [category("news", ["a"]), category("default", ["b"])],
        ["a", "b", "c"],
      ),
    ).toEqual([
      { id: "news", title: "news", channelIds: ["a"] },
      { id: "default", title: "default", channelIds: ["b", "c"] },
    ]);
  });

  test("replaces a stored default we cannot see any channel in", () => {
    expect(
      orderedCategories(
        [category("default", ["hidden"]), category("news", ["a"])],
        ["a"],
      ),
    ).toEqual([
      { id: "default", title: "Default", channelIds: [] },
      { id: "news", title: "news", channelIds: ["a"] },
    ]);
  });

  test("always offers a default to drop channels into", () => {
    expect(orderedCategories(undefined, [])).toEqual([
      { id: "default", title: "Default", channelIds: [] },
    ]);
  });
});

describe("applyChannelOrdering", () => {
  test("combines a drop between two views of the default category without losing IDs", () => {
    const afterSource = applyChannelOrdering(
      ["text-a", "voice-a"],
      ["text-a"],
      [],
    );
    expect(
      applyChannelOrdering(afterSource, ["voice-a"], ["voice-a", "text-a"]),
    ).toEqual(["voice-a", "text-a"]);
  });
  test("reorders text channels without dropping interleaved voice channels", () => {
    expect(
      applyChannelOrdering(
        ["text-a", "voice-a", "text-b", "voice-b"],
        ["text-a", "text-b"],
        ["text-b", "text-a"],
      ),
    ).toEqual(["voice-a", "text-b", "text-a", "voice-b"]);
  });
  test("keeps a hidden channel ahead of its channel when one moves away", () => {
    expect(
      applyChannelOrdering(["a", "hidden", "b"], ["a", "b"], ["b"]),
    ).toEqual(["hidden", "b"]);
  });

  test("moves a hidden channel with the channel it sits in front of", () => {
    expect(
      applyChannelOrdering(["a", "hidden", "b"], ["a", "b"], ["b", "a"]),
    ).toEqual(["hidden", "b", "a"]);
  });

  test("leaves a trailing hidden channel at the end", () => {
    expect(
      applyChannelOrdering(["a", "b", "hidden"], ["a", "b"], ["b", "a"]),
    ).toEqual(["b", "a", "hidden"]);
  });

  test("keeps a hidden channel whose channel left the category", () => {
    expect(
      applyChannelOrdering(["a", "hidden", "b"], ["a", "b"], ["a"]),
    ).toEqual(["a", "hidden"]);
  });

  test("places a channel dropped in from another category", () => {
    expect(
      applyChannelOrdering(["a", "b"], ["a", "b"], ["a", "c", "b"]),
    ).toEqual(["a", "c", "b"]);
  });

  test("keeps hidden channels when every displayed channel leaves", () => {
    expect(applyChannelOrdering(["hidden", "a"], ["a"], [])).toEqual([
      "hidden",
    ]);
  });
});

describe("categoriesToSave", () => {
  const ordered = [
    { id: "default", title: "Default", channelIds: ["a"] },
    { id: "cat", title: "Games", channelIds: ["b"] },
  ];

  test("leaves out the synthetic default group", () => {
    expect(categoriesToSave(ordered, ["cat"]).map((c) => c.id)).toEqual([
      "cat",
    ]);
  });

  test("keeps it when the server stores it or it was reordered", () => {
    expect(categoriesToSave(ordered, ["default", "cat"])).toHaveLength(2);
    expect(categoriesToSave(ordered, ["cat"], "default")).toHaveLength(2);
  });

  test("saves channels under the API name", () => {
    expect(categoriesToSave(ordered, ["cat"])[0]).toEqual({
      id: "cat",
      title: "Games",
      channels: ["b"],
    });
  });
});

describe("moveChannel", () => {
  const ordered = [
    { id: "default", title: "Default", channelIds: ["a", "v1"] },
    { id: "c1", title: "One", channelIds: ["b", "c", "d"] },
    { id: "c2", title: "Two", channelIds: [] },
  ];

  it("moves within a category, before or after a neighbour", () => {
    expect(
      moveChannel(ordered, { id: "d", to: "c1", before: "b" })[1].channelIds,
    ).toEqual(["d", "b", "c"]);
    expect(
      moveChannel(ordered, { id: "b", to: "c1", after: "c" })[1].channelIds,
    ).toEqual(["c", "b", "d"]);
  });

  it("moves into another category, an empty one, or out of every one", () => {
    const into = moveChannel(ordered, { id: "c", to: "c2" });
    expect(into[1].channelIds).toEqual(["b", "d"]);
    expect(into[2].channelIds).toEqual(["c"]);

    const out = moveChannel(ordered, { id: "b", to: "default", after: "a" });
    expect(out[0].channelIds).toEqual(["a", "b", "v1"]);
    expect(out[1].channelIds).toEqual(["c", "d"]);
  });

  it("leaves everything as it is for a category it does not know", () => {
    expect(moveChannel(ordered, { id: "b", to: "gone" })).toBe(ordered);
  });
});

describe("moveCategories", () => {
  it("keeps the default group first and nothing gets lost", () => {
    const ordered = [
      { id: "default", title: "Default", channelIds: [] },
      { id: "x", title: "X", channelIds: [] },
      { id: "y", title: "Y", channelIds: [] },
      { id: "z", title: "Z", channelIds: [] },
    ];
    expect(moveCategories(ordered, ["z", "x"]).map((c) => c.id)).toEqual([
      "default",
      "z",
      "x",
      "y",
    ]);
  });
});
